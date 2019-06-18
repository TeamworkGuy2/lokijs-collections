import Q = require("q");
import DbUtil = require("../persisters/DbUtil");
import IndexedDbPersister = require("../persisters/IndexedDbPersister");
import IndexedDbSpi = require("../persisters/IndexedDbSpi");
import WebSqlPersister = require("../persisters/WebSqlPersister");
import WebSqlSpi = require("../persisters/WebSqlSpi");

module CollectionsBrowserTestBase {
    // testing:
    /*
var idb = null; createIndexedDbPersister(1).then((i) => idb = i);
idb.addCollection("book", [memDb.createBook("1984", "George Orwell", 1949), memDb.createBook("Mere Christianity", "C.S. Lewis", 1952), memDb.createBook("Desiring God", "John Piper", 1986), memDb.createBook("Don't Waste Your Life", "John Piper", 2003)]); idb.getDataCollections()[1].dirty = true;
var rs = null; idb.persist({ maxObjectsPerChunk: 3, keyAutoGenerate: true }).then(r => console.log("persist done!", rs = r), (err) => console.error(err));
var rt = null; idb.restore(null, (name) => ({ isChunks: true })).then(r => console.log("restore done!", rt = r), (err) => console.error(err));
    */
    var colls = [{
        name: "books",
        data: <any[]>[],
        dirty: false,
        insert: function insert(dat: any) { Array.prototype.push.apply(this.data, dat); }
    }];
    var memDb = {
        listCollections: () => colls,
        getCollection: (name: string, auto?: boolean) => colls.find(x => x.name === name) || colls[0],
        createBook: (name: string, author: string, publishYear: number) => ({ name, author, publishYear }),
    };

    var storageLog: DataPersister.DbLogger = {
        error: function error() {
            console.error.apply(console, <any>arguments);
            debugger;
        },
        log: function log() {
            console.log.apply(console, <any>arguments);
            debugger;
        }
    };

    var persisterLog: DataPersister.DbLogger = {
        error: function error() {
            console.error.apply(console, <any>arguments);
            debugger;
        },
        log: function log() {
            console.log.apply(console, <any>arguments);
            debugger;
        }
    };

    var utilConfig: DataPersister.UtilConfig = {
        defer: <T>() => {
            var rt: DataPersister.SimpleDeferred<T> = {
                promise: <any>null,
                resolve: <any>null,
                reject: <any>null,
            };
            var p = new Promise<T>((rsl, rjc) => { rt.resolve = rsl; rt.reject = rjc; });
            rt.promise = <Q.Promise<T>><any>p;
            return rt;
        }, //Q.defer,
        whenAll: (ps) => <Q.Promise<any[]>><any>Promise.all(<any[]>ps), //(ps) => Q.all(<PromiseLike<any>[]>ps),
        trace: storageLog,
        verbosity: DbUtil.logLevels.DEBUG
    };


    export function createIndexedDbPersister(version: number | null = null) {
        return IndexedDbSpi.newIndexedDb("lokijs-collections-test", version, utilConfig).then((idb) => {
            return new IndexedDbPersister(idb, persisterLog, () => {
                return [{ name: "book_backup", data: <any[]>[] }].concat(memDb.listCollections());
            }, (collName: string, data: any[]) => {
                // when initially restoring collection data from persistent storage (during page load) don't mark collection as dirty (prevents a full save when the next persist() timer goes off)
                var initiallyEmpty = memDb.getCollection(collName, false) == null;
                var coll = memDb.getCollection(collName, true);
                coll.insert(data);
                if (initiallyEmpty) {
                    coll.dirty = false;
                }
                return coll;
            }, null/*(itm) => InMemDbImpl.cloneCloneDelete(itm, true)*/, null, (storageError) => {
                console.error("storage error, is quota full!?", storageError.sqlError.message);
            }, null, null);
        });
    }


    export function createWebSqlPersister(version: number | null = null) {
        return WebSqlSpi.newWebSqlDb("lokijs-collections-test", version, null, null, utilConfig).then((wsb) => {
            return new WebSqlPersister(wsb, persisterLog, () => {
                return [{ name: "book_backup", data: <any[]>[] }].concat(memDb.listCollections());
            }, (collName, data) => {
                // when initially restoring collection data from persistent storage (during page load) don't mark collection as dirty (prevents a full save when the next persist() timer goes off)
                var initiallyEmpty = memDb.getCollection(collName, false) == null;
                var coll = memDb.getCollection(collName, true);
                coll.insert(data);
                if (initiallyEmpty) {
                    coll.dirty = false;
                }
                return coll;
            }, null/*(itm) => InMemDbImpl.cloneCloneDelete(itm, true)*/, (k, v) => (k !== "$loki" && k !== "meta" ? v : undefined), null, (storageError) => {
                console.error("storage error, is quota full!?", storageError.sqlError.message);
            }, null, null);
        });
    }


    var Cctor = (function () {
        var globals = [
            IndexedDbPersister,
            IndexedDbSpi,
            createIndexedDbPersister,
            createWebSqlPersister,
            ((<any>colls).name = "colls", colls),
            ((<any>memDb).name = "memDb", memDb),
        ];
        for (var i = 0, size = globals.length; i < size; i++) {
            var glb = globals[i];
            (<any>window)[(<any>glb).name] = glb;
            console.log((<any>glb).name);
        }
    }());

}

export = CollectionsBrowserTestBase;