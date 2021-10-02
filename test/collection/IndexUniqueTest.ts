import chai = require("chai");
import Collection = require("../../db-collections/Collection");
import M = require("../TestModels");

var asr = chai.assert;

suite("Constraints", function () {

    test("should retrieve records with by()", function () {
        var db = M.createDb();
        var coll = db.addCollection<{ username: string; name: string }>("users", { unique: ["username"] });
        coll.insert({ username: "joe", name: "Joe" });
        coll.insert({ username: "jack", name: "Jack" });
        asr.equal(coll.by("username", "joe")?.name, "Joe");

        var byUsername = coll.by("username");
        asr.equal(byUsername("jack")?.name, "Jack");

        var joe = <{ username: string; name: string } & MemDbObj>coll.by("username", "joe");
        joe.username = "jack";
        asr.throws(() => coll.update(joe)); // "Duplicate key for property username: " + joe.username
        joe.username = "jim";
        coll.update(joe);
        asr.equal(byUsername("jim"), joe);
    });

    test("should create a unique index", function () {
        var db = M.createDb();
        var coll2 = db.addCollection("moreusers");
        coll2.insert({
            name: "jack"
        });
        coll2.insert({
            name: "tim"
        });
        coll2.ensureUniqueIndex("name");
    });

    test("should not add record with null index", function () {
        var db = M.createDb();
        var coll3 = db.addCollection<{ username: string | null; name: string }>("nullusers", { unique: ["username"] });

        coll3.insert({ username: "joe", name: "Joe" });
        coll3.insert({ username: null, name: "Jack" });

        asr.equal(Object.keys(coll3.constraints.unique.username.keyMap).length, 1);
    });

    test("should not throw an error id multiple nulls are added", function () {
        var db = M.createDb();
        var coll4 = db.addCollection<{ username: string | null; name: string }>("morenullusers", { unique: ["username"] });

        coll4.insert({ username: "joe", name: "Joe" });
        coll4.insert({ username: null, name: "Jack" });
        coll4.insert({ username: null, name: "Jake" });

        asr.equal(Object.keys(coll4.constraints.unique.username.keyMap).length, 1);
    });

    //test("coll.clear should affect unique indices correctly", function () {
    //    var db = M.createDb();
    //    var coll = db.addCollection("users", { unique: ["username"] });
    //
    //    coll.insert({ username: "joe", name: "Joe" });
    //    coll.insert({ username: "jack", name: "Jack" });
    //    coll.insert({ username: "jake", name: "Jake" });
    //    asr.equal(Object.keys(coll.constraints.unique.username.keyMap).length, 3);
    //    asr.equal(coll.uniqueNames.length, 1);
    //    coll.clear();
    //    asr.isUndefined(coll.constraints.unique.username);
    //    coll.insert({ username: "joe", name: "Joe" });
    //    coll.insert({ username: "jack", name: "Jack" });
    //    asr.equal(Object.keys(coll.constraints.unique.username.keyMap).length, 2);
    //    coll.insert({ username: "jake", name: "Jake" });
    //    asr.equal(Object.keys(coll.constraints.unique.username.keyMap).length, 3);
    //    asr.equal(coll.uniqueNames.length, 1);
    //
    //    var db = M.createDb();
    //    var coll = db.addCollection("users", { unique: ["username"] });
    //
    //    coll.insert({ username: "joe", name: "Joe" });
    //    coll.insert({ username: "jack", name: "Jack" });
    //    coll.insert({ username: "jake", name: "Jake" });
    //    asr.equal(Object.keys(coll.constraints.unique.username.keyMap).length, 3);
    //    asr.equal(coll.uniqueNames.length, 1);
    //    coll.clear();
    //    asr.isFalse(coll.constraints.unique.hasOwnProperty("username"));
    //    asr.equal(coll.uniqueNames.length, 0);
    //    coll.insert({ username: "joe", name: "Joe" });
    //    coll.insert({ username: "jack", name: "Jack" });
    //    coll.insert({ username: "jake", name: "Jake" });
    //    asr.isFalse(coll.constraints.unique.hasOwnProperty("username"));
    //    asr.equal(coll.uniqueNames.length, 0);
    //});

    test("batch removes should update unique contraints", function () {
        var data = [
            { name: "Sleipnir", legs: 8 },
            { name: "Jormungandr", legs: 0 },
            { name: "Hel", legs: 2 }
        ];

        var db = M.createDb("test.db");
        var collection = db.addCollection("children", {
            unique: ["name"]
        });

        data.forEach(function (c) {
            collection.insert(JSON.parse(JSON.stringify(c)));
        });

        collection.clear();

        // reinsert 2 of the 3 original docs
        // implicitly "expecting" that this will not throw exception on Duplicate key for property name(s)
        collection.insert(JSON.parse(JSON.stringify(data[0])));
        collection.insert(JSON.parse(JSON.stringify(data[1])));

        var keys = Object.keys(collection.constraints.unique.name.keyMap);
        //asr.equal(keys.length, 3); // TODO this is changed in a newer version of lokijs, possibly to fix memory leak with 'delete obj[key]' in some JS engine implementations
        keys.sort();
        // seems we don"t delete the key but set its value to undefined
        //asr.equal(keys[0], "Hel"); // TODO this is changed in a newer version of lokijs, possibly to fix memory leak with 'delete obj[key]' in some JS engine implementations
        asr.isTrue(typeof collection.constraints.unique.name.keyMap["Hel"] === "undefined");
        // the rest were re-added so they should not only exist but be undefined
        asr.equal(keys[0], "Jormungandr");
        asr.isFalse(typeof collection.constraints.unique.name.keyMap["Jormungandr"] === "undefined");
        asr.equal(keys[1], "Sleipnir");
        asr.isFalse(typeof collection.constraints.unique.name.keyMap["Sleipnir"] === "undefined");
    });

    test("chained batch updates should update constraints", function () {
        var data = [
            { name: "Sleipnir", legs: 8 },
            { name: "Jormungandr", legs: 0 },
            { name: "Hel", legs: 2 }
        ];

        var db = M.createDb("test.db");
        var collection = db.addCollection("children", {
            unique: ["name"]
        });

        data.forEach(function (c) {
            collection.insert(JSON.parse(JSON.stringify(c)));
        });

        collection.chain().update(function (obj) {
            obj.name = obj.name + "2";
        });

        // implicitly 'expecting' that this will not throw exception on Duplicate key for property name: Sleipnir
        data.forEach(function (c) {
            collection.insert(JSON.parse(JSON.stringify(c)));
        });

        var keys = Object.keys(collection.constraints.unique.name.keyMap);
        asr.equal(keys.length, 6);
        keys.sort();
        asr.equal(keys[0], "Hel");
        asr.equal(keys[1], "Hel2");
        asr.equal(keys[2], "Jormungandr");
        asr.equal(keys[3], "Jormungandr2");
        asr.equal(keys[4], "Sleipnir");
        asr.equal(keys[5], "Sleipnir2");
    });

    test("batch updates should update constraints", function () {
        var data = [
            { name: "Sleipnir", legs: 8 },
            { name: "Jormungandr", legs: 0 },
            { name: "Hel", legs: 2 }
        ];

        var db = M.createDb("test.db");
        var collection = db.addCollection("children", { unique: ["name"] });

        // batch insert docs
        var docs = collection.insert(<any[]>JSON.parse(JSON.stringify(data)));

        // batch update docs (by passing array to collection.update())
        docs.forEach(function (obj: any) {
            obj.name = obj.name + "2";
        });
        collection.update(docs);

        // reinsert originals (implicitly 'expecting' that this will not throw exception on Duplicate key)
        collection.insert(data);

        var keys = Object.keys(collection.constraints.unique.name.keyMap);
        asr.equal(keys.length, 6);
        keys.sort();
        asr.equal(keys[0], "Hel");
        asr.equal(keys[1], "Hel2");
        asr.equal(keys[2], "Jormungandr");
        asr.equal(keys[3], "Jormungandr2");
        asr.equal(keys[4], "Sleipnir");
        asr.equal(keys[5], "Sleipnir2");
    });

    test("should not crash on unsafe strings", function () {
        var db = M.createDb();
        var coll = db.addCollection<{ key: string; name: string }>("local_storage", { unique: ["key"] });

        asr.isNull(coll.by("key", "hasOwnProperty"));
        coll.insert({ key: "hasOwnProperty", name: "hey" });
        asr.equal(coll.by("key", "hasOwnProperty")?.name, "hey");
    });

});
