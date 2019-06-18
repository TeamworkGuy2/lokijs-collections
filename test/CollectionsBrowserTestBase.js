"use strict";
var DbUtil = require("../persisters/DbUtil");
var IndexedDbPersister = require("../persisters/IndexedDbPersister");
var IndexedDbSpi = require("../persisters/IndexedDbSpi");
var WebSqlPersister = require("../persisters/WebSqlPersister");
var WebSqlSpi = require("../persisters/WebSqlSpi");
var CollectionsBrowserTestBase;
(function (CollectionsBrowserTestBase) {
    // testing:
    /*
var idb = null; createIndexedDbPersister(1).then((i) => idb = i);
idb.addCollection("book", [memDb.createBook("1984", "George Orwell", 1949), memDb.createBook("Mere Christianity", "C.S. Lewis", 1952), memDb.createBook("Desiring God", "John Piper", 1986), memDb.createBook("Don't Waste Your Life", "John Piper", 2003)]); idb.getDataCollections()[1].dirty = true;
var rs = null; idb.persist({ maxObjectsPerChunk: 3, keyAutoGenerate: true }).then(r => console.log("persist done!", rs = r), (err) => console.error(err));
var rt = null; idb.restore(null, (name) => ({ isChunks: true })).then(r => console.log("restore done!", rt = r), (err) => console.error(err));
    */
    var colls = [{
            name: "books",
            data: [],
            dirty: false,
            insert: function insert(dat) { Array.prototype.push.apply(this.data, dat); }
        }];
    var memDb = {
        listCollections: function () { return colls; },
        getCollection: function (name, auto) { return colls.find(function (x) { return x.name === name; }) || colls[0]; },
        createBook: function (name, author, publishYear) { return ({ name: name, author: author, publishYear: publishYear }); },
    };
    var storageLog = {
        error: function error() {
            console.error.apply(console, arguments);
            debugger;
        },
        log: function log() {
            console.log.apply(console, arguments);
            debugger;
        }
    };
    var persisterLog = {
        error: function error() {
            console.error.apply(console, arguments);
            debugger;
        },
        log: function log() {
            console.log.apply(console, arguments);
            debugger;
        }
    };
    var utilConfig = {
        defer: function () {
            var rt = {
                promise: null,
                resolve: null,
                reject: null,
            };
            var p = new Promise(function (rsl, rjc) { rt.resolve = rsl; rt.reject = rjc; });
            rt.promise = p;
            return rt;
        },
        whenAll: function (ps) { return Promise.all(ps); },
        trace: storageLog,
        verbosity: DbUtil.logLevels.DEBUG
    };
    function createIndexedDbPersister(version) {
        if (version === void 0) { version = null; }
        return IndexedDbSpi.newIndexedDb("lokijs-collections-test", version, utilConfig).then(function (idb) {
            return new IndexedDbPersister(idb, persisterLog, function () {
                return [{ name: "book_backup", data: [] }].concat(memDb.listCollections());
            }, function (collName, data) {
                // when initially restoring collection data from persistent storage (during page load) don't mark collection as dirty (prevents a full save when the next persist() timer goes off)
                var initiallyEmpty = memDb.getCollection(collName, false) == null;
                var coll = memDb.getCollection(collName, true);
                coll.insert(data);
                if (initiallyEmpty) {
                    coll.dirty = false;
                }
                return coll;
            }, null /*(itm) => InMemDbImpl.cloneCloneDelete(itm, true)*/, null, function (storageError) {
                console.error("storage error, is quota full!?", storageError.sqlError.message);
            }, null, null);
        });
    }
    CollectionsBrowserTestBase.createIndexedDbPersister = createIndexedDbPersister;
    function createWebSqlPersister(version) {
        if (version === void 0) { version = null; }
        return WebSqlSpi.newWebSqlDb("lokijs-collections-test", version, null, null, utilConfig).then(function (wsb) {
            return new WebSqlPersister(wsb, persisterLog, function () {
                return [{ name: "book_backup", data: [] }].concat(memDb.listCollections());
            }, function (collName, data) {
                // when initially restoring collection data from persistent storage (during page load) don't mark collection as dirty (prevents a full save when the next persist() timer goes off)
                var initiallyEmpty = memDb.getCollection(collName, false) == null;
                var coll = memDb.getCollection(collName, true);
                coll.insert(data);
                if (initiallyEmpty) {
                    coll.dirty = false;
                }
                return coll;
            }, null /*(itm) => InMemDbImpl.cloneCloneDelete(itm, true)*/, function (k, v) { return (k !== "$loki" && k !== "meta" ? v : undefined); }, null, function (storageError) {
                console.error("storage error, is quota full!?", storageError.sqlError.message);
            }, null, null);
        });
    }
    CollectionsBrowserTestBase.createWebSqlPersister = createWebSqlPersister;
    var Cctor = (function () {
        var globals = [
            IndexedDbPersister,
            IndexedDbSpi,
            createIndexedDbPersister,
            createWebSqlPersister,
            (colls.name = "colls", colls),
            (memDb.name = "memDb", memDb),
        ];
        for (var i = 0, size = globals.length; i < size; i++) {
            var glb = globals[i];
            window[glb.name] = glb;
            console.log(glb.name);
        }
    }());
})(CollectionsBrowserTestBase || (CollectionsBrowserTestBase = {}));
module.exports = CollectionsBrowserTestBase;
