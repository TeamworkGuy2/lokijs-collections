import chai = require("chai");
import Collection = require("../../db-collections/Collection");
import Resultset = require("../../db-collections/Resultset");
import M = require("../TestModels");

var asr = chai.assert;

suite("sorting and indexing", function () {
    var db: MemDb;

    setup(function () {
        db = M.createDb("sortingIndexingTest");
        var items = db.addCollection("items");

        items.insert({ name: "mjolnir", owner: "thor", maker: "dwarves" });
        items.insert({ name: "gungnir", owner: "odin", maker: "elves" });
        items.insert({ name: "tyrfing", owner: "Svafrlami", maker: "dwarves" });
        items.insert({ name: "draupnir", owner: "odin", maker: "elves" });
    });

    test("resultset simplesort", function () {
        var rss = db.addCollection<{ a: number; b: number }>("rssort");

        rss.insert({ a: 4, b: 2 });
        rss.insert({ a: 7, b: 1 });
        rss.insert({ a: 3, b: 4 });
        rss.insert({ a: 9, b: 5 });

        var results = rss.chain().simplesort("a").data();
        asr.equal(results[0].a, 3);
        asr.equal(results[1].a, 4);
        asr.equal(results[2].a, 7);
        asr.equal(results[3].a, 9);
    });

    test("resultset simplesort descending", function () {
        var rss = db.addCollection<{ a: number; b: number }>("rssort");

        rss.insert({ a: 4, b: 2 });
        rss.insert({ a: 7, b: 1 });
        rss.insert({ a: 3, b: 4 });
        rss.insert({ a: 9, b: 5 });

        var results = rss.chain().simplesort("a", true).data();
        asr.equal(results[0].a, 9);
        asr.equal(results[1].a, 7);
        asr.equal(results[2].a, 4);
        asr.equal(results[3].a, 3);

        // test when indexed
        var rss2 = db.addCollection<{ a: number; b: number }>("rssort2", { indices: ["a"] });

        rss2.insert({ a: 4, b: 2 });
        rss2.insert({ a: 7, b: 1 });
        rss2.insert({ a: 3, b: 4 });
        rss2.insert({ a: 9, b: 5 });

        results = rss2.chain().simplesort("a", true).data();
        asr.equal(results[0].a, 9);
        asr.equal(results[1].a, 7);
        asr.equal(results[2].a, 4);
        asr.equal(results[3].a, 3);
    });

    // nested properties supported in lokijs, not in lokijs-collections
    //test("resultset simplesort on nested properties", function () {
    //    var rss = db.addCollection<{ foo: any }>("rssort");
    //
    //    rss.insert({ foo: { a: 4, b: 2 } });
    //    rss.insert({ foo: { a: 7, b: 1 } });
    //    rss.insert({ foo: { a: 3, b: 4 } });
    //    rss.insert({ foo: { a: 9, b: 5 } });
    //
    //    var results = rss.chain().simplesort(<any>"foo.a").data();
    //    asr.equal(results[0].foo.a, 3);
    //    asr.equal(results[1].foo.a, 4);
    //    asr.equal(results[2].foo.a, 7);
    //    asr.equal(results[3].foo.a, 9);
    //});

    test("resultset simplesort with dates", function () {
        var now = new Date().getTime();
        var dt1 = new Date(now - 1000);
        var dt2 = new Date(now + 5000);
        var dt3 = new Date(2000, 6, 1);
        var dt4 = new Date(now + 2000);
        var dt5 = new Date(now - 3000);

        var rss = db.addCollection<{ a: number; b: Date }>("rssort");

        rss.insert({ a: 1, b: dt1 });
        rss.insert({ a: 2, b: dt2 });
        rss.insert({ a: 3, b: dt3 });
        rss.insert({ a: 4, b: dt4 });
        rss.insert({ a: 5, b: dt5 });

        var results = rss.chain().simplesort("b").data();
        asr.equal(results[0].a, 3);
        asr.equal(results[1].a, 5);
        asr.equal(results[2].a, 1);
        asr.equal(results[3].a, 4);
        asr.equal(results[4].a, 2);
    });

    test("resultset sort works correctly", function () {
        var db = M.createDb("test.db");
        var coll = db.addCollection("coll");

        coll.insert([{ a: 1, b: 9, c: "first" }, { a: 5, b: 7, c: "second" }, { a: 2, b: 9, c: "third" }]);

        function sortfun(obj1: any, obj2: any): number {
            if (obj1.a === obj2.a) return 0;
            if (obj1.a > obj2.a) return 1;
            if (obj1.a < obj2.a) return -1;
            return <number><any>undefined;
        };

        var result = coll.chain().sort(sortfun).data();
        asr.equal(result.length, 3);
        asr.equal(result[0].a, 1);
        asr.equal(result[1].a, 2);
        asr.equal(result[2].a, 5);
    });

    test("resultset compoundsort works correctly", function () {
        var db = M.createDb("test.db");
        var coll = db.addCollection("coll");

        coll.insert([{ a: 1, b: 9, c: "first" }, { a: 5, b: 7, c: "second" }, { a: 2, b: 9, c: "third" }]);

        var result = coll.chain().compoundsort(["b", "c"]).data();
        asr.equal(result.length, 3);
        asr.equal(result[0].a, 5);
        asr.equal(result[1].a, 1);
        asr.equal(result[2].a, 2);

        result = coll.chain().compoundsort(["b", ["c", true]]).data();
        asr.equal(result.length, 3);
        asr.equal(result[0].a, 5);
        asr.equal(result[1].a, 2);
        asr.equal(result[2].a, 1);
    });

    // nested properties supported in lokijs, not in lokijs-collections
    //test("resultset compoundsort on nested properties works correctly", function () {
    //    var db = M.createDb("test.db");
    //    var coll = db.addCollection("coll");
    //
    //    coll.insert([{ a: 1, z: { y: { b: 9, c: "first" } } }, { a: 5, z: { y: { b: 7, c: "second" } } }, { a: 2, z: { y: { b: 9, c: "third" } } }]);
    //
    //    var result = coll.chain().compoundsort(["z.y.b", "z.y.c"]).data();
    //    asr.equal(result.length, 3);
    //    asr.equal(result[0].a, 5);
    //    asr.equal(result[1].a, 1);
    //    asr.equal(result[2].a, 2);
    //
    //    result = coll.chain().compoundsort(["z.y.b", ["z.y.c", true]]).data();
    //    asr.equal(result.length, 3);
    //    asr.equal(result[0].a, 5);
    //    asr.equal(result[1].a, 2);
    //    asr.equal(result[2].a, 1);
    //});

    // nested properties supported in lokijs, not in lokijs-collections
    //test("collection indexing - mixed types sort as expected", function () {
    //    var mtdb = M.createDb("mtdb");
    //    var coll = db.addCollection<{ a?: any; [index: string]: any }>("coll");
    //    coll.insert({ a: undefined, b: 5 });
    //    coll.insert({ b: 5 });
    //    coll.insert({ a: null, b: 5 });
    //    coll.insert({ a: 7, b: 5 });
    //    coll.insert({ a: "7", b: 5 });
    //    coll.insert({ a: 7.0, b: 5 });
    //    coll.insert({ a: "11", b: 5 });
    //    coll.insert({ a: "4", b: 5 });
    //    coll.insert({ a: new Date(), b: 5 });
    //    coll.insert({ a: { ack: "object" }, b: 5 });
    //    coll.insert({ a: 7.5, b: 5 });
    //    coll.insert({ a: NaN, b: 5 });
    //    coll.insert({ a: [8, 1, 15], b: 5 });
    //    coll.insert({ a: "asdf", b: 5 });
    //
    //    var indexVals: any[] = [];
    //
    //    // make sure unindexed sort is as expected
    //
    //    var result = coll.chain().simplesort("a").data();
    //    result.forEach(function (obj) {
    //        indexVals.push(obj.a);
    //    });
    //
    //    asr.equal(indexVals.length, 14);
    //
    //    // undefined, null, or NaN
    //    asr.isTrue(indexVals[0] !== indexVals[0]);
    //    asr.isTrue(indexVals[1] == null);
    //    asr.isTrue(indexVals[2] == null);
    //    asr.isTrue(indexVals[3] == null);
    //
    //    asr.isTrue(indexVals[4] === "4");
    //    asr.isTrue(indexVals[5] === "7" || indexVals[5] === 7);
    //    asr.isTrue(indexVals[6] === "7" || indexVals[5] === 7);
    //    asr.isTrue(indexVals[7] === "7" || indexVals[5] === 7);
    //    asr.isTrue(indexVals[8] === 7.5);
    //    asr.isTrue(indexVals[9] === "11");
    //    asr.isTrue(indexVals[10] instanceof Date);
    //    asr.isTrue(Array.isArray(indexVals[11]));
    //    asr.isTrue(typeof indexVals[12] === "object");
    //    asr.isTrue(indexVals[13] === "asdf");
    //
    //    // now make sure binary index uses same range
    //    indexVals = [];
    //    coll.ensureIndex("a");
    //
    //    coll.binaryIndices.a?.values?.forEach(function (vi) {
    //        indexVals.push(coll.data[vi].a);
    //    });
    //
    //    asr.equal(indexVals.length, 14);
    //
    //    // undefined, null, or NaN
    //    asr.isTrue(indexVals[0] !== indexVals[0]);
    //    asr.isTrue(indexVals[1] == null);
    //    asr.isTrue(indexVals[2] == null);
    //    asr.isTrue(indexVals[3] == null);
    //
    //    asr.isTrue(indexVals[4] === "4");
    //    asr.isTrue(indexVals[5] === "7" || indexVals[5] === 7);
    //    asr.isTrue(indexVals[6] === "7" || indexVals[5] === 7);
    //    asr.isTrue(indexVals[7] === "7" || indexVals[5] === 7);
    //    asr.isTrue(indexVals[8] === 7.5);
    //    asr.isTrue(indexVals[9] === "11");
    //    asr.isTrue(indexVals[10] instanceof Date);
    //    asr.isTrue(Array.isArray(indexVals[11]));
    //    asr.isTrue(typeof indexVals[12] === "object");
    //    asr.isTrue(indexVals[13] === "asdf");
    //});

    test("collection indexing", function () {
        var now = new Date().getTime();
        var dt1 = -1000; // new Date(now - 1000);
        var dt2 = 5000; // new Date(now + 5000);
        var dt3 = 0; // new Date(2000, 6, 1);
        var dt4 = 2000; // new Date(now + 2000);
        var dt5 = -3000; // new Date(now - 3000);

        var cidx = db.addCollection<{ a: number; b: string | number }>("collidx", { indices: ["b"] });

        cidx.insert({ a: 1, b: dt1 });
        cidx.insert({ a: 2, b: dt2 });
        cidx.insert({ a: 3, b: dt3 });
        cidx.insert({ a: 4, b: dt4 });
        cidx.insert({ a: 5, b: dt5 });

        // force index build while simultaneously testing date equality test
        var results = cidx.find({ "b": { $aeq: dt2 } });
        asr.equal(results[0].a, 2);

        // NOTE :
        // Binary Index imposes loose equality checks to construct its order
        // Strict equality checks would need to be extra filtering phase

        var sdt = "5000"; // new Date(now + 5000);

        // after refactoring binary indices to be loose equality/ranges everywhere,
        // this unit test passed, meaning the dteq op is not needed if binary index exists

        //results = cidx.find({"b": sdt});
        //expect(results.length).toBe(0);

        // '$dteq' lokijs Ops isn't supported by lokijs-collection
        // now try with new $dteq operator
        //results = cidx.find({ "b": { "$dteq": sdt } });
        //asr.equal(results.length, 1);
        //asr.equal(results[0].a, 2);

        // now verify indices
        // they are array of "positions" so both array index and value are zero based
        //asr.equal(cidx.binaryIndices.b.values[0], 2);
        //asr.equal(cidx.binaryIndices.b.values[1], 4);
        //asr.equal(cidx.binaryIndices.b.values[2], 0);
        //asr.equal(cidx.binaryIndices.b.values[3], 3);
        //asr.equal(cidx.binaryIndices.b.values[4], 1);
    });

    test("simplesort index intersect works correctly", function () {
        var db = M.createDb("rss.db");
        var rss = db.addCollection<{ a: number; b: number }>("rssort", { indices: ["a"] });

        rss.insert({ a: 4, b: 1 });
        rss.insert({ a: 7, b: 1 });
        rss.insert({ a: 3, b: 1 });
        rss.insert({ a: 9, b: 5 });
        rss.insert({ a: 14, b: 1 });
        rss.insert({ a: 17, b: 1 });
        rss.insert({ a: 13, b: 1 });
        rss.insert({ a: 19, b: 5 });

        // test explicit force index intercept simplesort code path
        var results = rss.chain().find({ b: 1 }).simplesort("a").data();
        var len = results.length;

        asr.equal(len, 6);
        for (var idx = 0; idx < len - 1; idx++) {
            asr.isTrue(Resultset.LokiOps.$lte(results[idx]["a"], results[idx + 1]["a"]));
        }

        // test explicit disable index intercept simplesort code path
        results = rss.chain().find({ b: 1 }).simplesort("a").data();
        asr.equal(len, 6);
        for (var idx = 0; idx < len - 1; idx++) {
            asr.isTrue(Resultset.LokiOps.$lte(results[idx]["a"], results[idx + 1]["a"]));
        }

        // test "smart" simplesort
        results = rss.chain().find({ b: 1 }).simplesort("a").data();
        asr.equal(len, 6);
        for (var idx = 0; idx < len - 1; idx++) {
            asr.isTrue(Resultset.LokiOps.$lte(results[idx]["a"], results[idx + 1]["a"]));
        }
    });

    test("simplesort using javascript sorting works correctly", function () {
        var db = M.createDb("rss.db");
        var rss = db.addCollection<{ a: number; b: number }>("rssort");

        rss.insert({ a: 4, b: 1 });
        rss.insert({ a: 7, b: 1 });
        rss.insert({ a: 3, b: 1 });
        rss.insert({ a: 9, b: 5 });
        rss.insert({ a: 14, b: 1 });
        rss.insert({ a: 17, b: 1 });
        rss.insert({ a: 13, b: 1 });
        rss.insert({ a: 19, b: 5 });

        // test explicit force index intercept simplesort code path
        var results = rss.chain().find({ b: 1 }).simplesort("a").data();
        var len = results.length;

        asr.equal(len, 6);
        for (var idx = 0; idx < len - 1; idx++) {
            asr.isTrue(Resultset.LokiOps.$lte(results[idx]["a"], results[idx + 1]["a"]));
        }
    });

});
