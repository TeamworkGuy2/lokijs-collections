import chai = require("chai");
import M = require("../TestModels");

var asr = chai.assert;

suite("eventEmitter", function () {
    var db: MemDb;

    setup(function () {
        db = M.createDb("test");
        var users = db.addCollection("users");

        users.insert({
            name: "joe"
        });
    });

    test("emit", function () {
        var index = db.events.on(<any>"test", function test(obj) {
            asr.equal(obj, 42);
        });

        db.events.emit(<any>"test", 42);
        db.events.removeListener(<any>"test", index);

        asr.equal((<any>db.events.events)["test"].length, 0);

        asr.throws(() => db.events.emit(<any>"testEvent")); // "No event testEvent defined"
    });

});
