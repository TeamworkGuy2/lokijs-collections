"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai = require("chai");
var M = require("../TestModels");
var asr = chai.assert;
suite("eventEmitter", function () {
    var db;
    setup(function () {
        db = M.createDb("test");
        var users = db.addCollection("users");
        users.insert({
            name: "joe"
        });
    });
    test("emit", function () {
        var index = db.events.on("test", function test(obj) {
            asr.equal(obj, 42);
        });
        db.events.emit("test", 42);
        db.events.removeListener("test", index);
        asr.equal(db.events.events["test"].length, 0);
        asr.throws(function () { return db.events.emit("testEvent"); }); // "No event testEvent defined"
    });
});
