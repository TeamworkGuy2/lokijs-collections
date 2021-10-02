import chai = require("chai");
import Collection = require("../../db-collections/Collection");
import M = require("../TestModels");

var asr = chai.assert;

suite("changesApi", function () {

    test("does what it says on the tin", function () {
        var db = M.createDb();
        //    gordian = require("gordian"),
        //    suite = new gordian("testEvents");
        var options = {
            asyncListeners: false,
            disableChangesApi: false
        };
        var users = db.addCollection("users", options);
        var test = db.addCollection("test", options);
        var test2 = db.addCollection("test2", options);

        var u = users.insert({ name: "joe" });
        u.name = "jack";
        users.update(u);

        test.insert({ name: "test" });
        test2.insert({ name: "test2" });

        var userChanges = db.changeTracker.generateChangesNotification(["users"]);

        asr.equal(userChanges.length, 2);
        asr.equal(db.changeTracker.serializeChanges(["users"]), JSON.stringify(userChanges));

        var someChanges = db.changeTracker.generateChangesNotification(["users", "test2"]);

        asr.equal(someChanges.length, 3);
        var allChanges = db.changeTracker.generateChangesNotification();

        asr.equal(allChanges.length, 4);
        users.setChangesApi(false);
        asr.isTrue(users.disableChangesApi);

        u.name = "john";
        users.update(u);
        var newChanges = db.changeTracker.generateChangesNotification(["users"]);

        asr.equal(newChanges.length, 2);
        db.changeTracker.clearChanges();

        asr.equal(users.getChanges().length, 0);

        u.name = "jim";
        users.update(u);
        users.flushChanges();

        asr.equal(users.getChanges().length, 0);
    });

    test("works with delta mode", function () {
        var db = M.createDb();
        var options = {
            asyncListeners: false,
            disableChangesApi: false,
            disableDeltaChangesApi: false
        };
        var items = db.addCollection("items", options);

        // Add some documents to the collection
        items.insert({ name: "mjolnir", owner: "thor", maker: { name: "dwarves", count: 1 } });
        items.insert({ name: "gungnir", owner: "odin", maker: { name: "elves", count: 1 } });
        items.insert({ name: "tyrfing", owner: "Svafrlami", maker: { name: "dwarves", count: 1 } });
        items.insert({ name: "draupnir", owner: "odin", maker: { name: "elves", count: 1 } });

        // Find and update an existing document
        var tyrfing = items.findOne({ name: "tyrfing" });
        tyrfing.owner = "arngrim";
        items.update(tyrfing);
        tyrfing.maker.count = 4;
        items.update(tyrfing);

        var changesSerialized = db.changeTracker.serializeChanges(["items"]);
        var changes = <MemDbCollectionChange[]>JSON.parse(changesSerialized);

        asr.equal(changes.length, 6);

        var firstUpdate = changes[4];
        asr.equal(firstUpdate.operation, "U");
        asr.equal(firstUpdate.obj.owner, "arngrim");
        //asr.isUndefined(firstUpdate.obj.name);

        var secondUpdate = changes[5];
        asr.equal(secondUpdate.operation, "U");
        //asr.isUndefined(secondUpdate.obj.owner);
        asr.include(secondUpdate.obj.maker, { count: 4 });

    });

    test("batch operations work with delta mode", function () {
        var db = M.createDb();
        var items = db.addCollection("items", {
            //asyncListeners: false,
            disableChangesApi: false,
            //disableDeltaChangesApi: false
        });

        // Add some documents to the collection
        items.insert([
            { name: "mjolnir", owner: "thor", maker: "dwarves", count: 0 },
            { name: "gungnir", owner: "odin", maker: "elves", count: 0 },
            { name: "tyrfing", owner: "Svafrlami", maker: "dwarves", count: 0 },
            { name: "draupnir", owner: "odin", maker: "elves", count: 0 }
        ]);

        items.chain().update(function (o) { o.count++; });

        var changesSerialized = db.changeTracker.serializeChanges(["items"]);
        var changes = <MemDbCollectionChange[]>JSON.parse(changesSerialized);

        asr.equal(changes.length, 8);

        asr.equal(changes[0].name, "items");
        asr.equal(changes[0].operation, "I");
        asr.equal(changes[1].name, "items");
        asr.equal(changes[1].operation, "I");
        asr.equal(changes[2].name, "items");
        asr.equal(changes[2].operation, "I");
        asr.equal(changes[3].name, "items");
        asr.equal(changes[3].operation, "I");

        asr.equal(changes[4].name, "items");
        asr.equal(changes[4].operation, "U");
        asr.equal(changes[4].obj.count, 1);
        asr.equal(changes[5].name, "items");
        asr.equal(changes[5].operation, "U");
        asr.equal(changes[5].obj.count, 1);
        asr.equal(changes[6].name, "items");
        asr.equal(changes[6].operation, "U");
        asr.equal(changes[6].obj.count, 1);
        asr.equal(changes[7].name, "items");
        asr.equal(changes[7].operation, "U");
        asr.equal(changes[7].obj.count, 1);

        var keys = Object.keys(changes[7].obj);
        keys.sort();
        asr.equal(keys[0], "$loki");
        asr.equal(keys[1], "count");
        asr.equal(keys[3], "meta");
    });

});
