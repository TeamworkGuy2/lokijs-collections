import chai = require("chai");
import Collection = require("../../db-collections/Collection");
import MemDbPersisters = require("../../persisters/MemDbPersisters");
import M = require("../TestModels");

var asr = chai.assert;

suite("autoupdate", function () {

    test("auto updates inserted documents", function (done) {
        if (typeof (<any>Object).observe !== "function") {
            done();
            return;
        }

        var coll = new Collection("test", {
            unique: ["name"],
            //autoupdate: true
        });

        coll.insert({
            name: "Jack"
        });

        var doc = coll.insert({
            name: "Peter"
        });

        function change1() {
            coll.events.on("update", function (target) {
                asr.equal(target, doc);

                change2();
            });
            doc.name = "John";
        }

        function change2() {
            coll.events.on("error", function (err) {
                asr.deepEqual(err, new Error("Duplicate key for property name: " + doc.name));
                done();
            });
            doc.name = "Jack";
        }

        change1();
    });

    test("auto updates documents loaded from storage", function (done) {

        if (typeof (<any>Object).observe !== "function") {
            done();
            return;
        }

        var db1 = M.createDb("autoupdate1.json");
        var db2 = M.createDb("autoupdate2.json");

        var coll = new Collection("test", {
            unique: ["name"],
            //autoupdate: true
        });

        var originalDocs = coll.insert([{
            name: "Jack"
        }, {
            name: "Peter"
        }]);

        var db1Persister = new MemDbPersisters.DbPersister("testfile1.db", () => db1.collections);
        var db2Persister = new MemDbPersisters.DbPersister("testfile2.db", () => db2.collections);
        db2Persister.loadJSON(db1Persister.serialize(), db1, {});

        coll = new Collection("test");

        var doc = <any>coll.by("name", "Peter");

        //asr.isTrue(coll.autoupdate);
        asr.deepEqual(doc, originalDocs[1]);

        function change1() {
            coll.events.on("update", function (target) {
                asr.equal(target, doc);

                change2();
            });
            doc.name = "John";
        }

        function change2() {
            coll.events.on("error", function (err) {
                asr.deepEqual(err, new Error("Duplicate key for property name: " + doc.name));
                done();
            });
            doc.name = "Jack";
        }

        change1();
    });

});
