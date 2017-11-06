"use strict";
/**-----------------+
 | PERSISTENCE      |
 -------------------*
 * there are two build in persistence adapters for internal use
 * fs             for use in Nodejs type environments
 * localStorage   for use in browser environment
 * defined as helper classes here so its easy and clean to use
 */
var MemDbPersisters;
(function (MemDbPersisters) {
    var DbPersister = (function () {
        function DbPersister(filename, getCollections) {
            // alias
            this.save = DbPersister.prototype.saveDatabase;
            // alias of serialize
            this.toJson = DbPersister.prototype.serialize;
            this.filename = filename;
            // autosave support (disabled by default)
            // pass autosave: true, autosaveInterval: 6000 in options to set 6 second autosave
            this.autosave = false;
            this.autosaveInterval = 5000;
            this.autosaveHandle = null;
            // currently keeping persistenceMethod and persistenceAdapter as MemDb level properties that
            // will not or cannot be deserialized.  You are required to configure persistence every time
            // you instantiate a MemDb object (or use default environment detection) in order to load the database anyways.
            // persistenceMethod could be 'fs', 'localStorage', or 'adapter'
            // this is optional option param, otherwise environment detection will be used
            // if user passes their own adapter we will force this method to 'adapter' later, so no need to pass method option.
            this.persistenceMethod = null;
            // retain reference to optional (non-serializable) persistenceAdapter 'instance'
            this.persistenceAdapter = null;
            this.getCollections = getCollections;
        }
        /** Handles loading from file system, local storage, or adapter (indexeddb)
         *    This method utilizes MemDb configuration options (if provided) to determine which
         *    persistence method to use, or environment detection (if configuration was not provided).
         *
         * @param options - not currently used (remove or allow overrides?)
         * @param callback - (Optional) user supplied async callback / error handler
         */
        DbPersister.prototype.loadDatabase = function (db, options, callback) {
            var cbFunc = callback || function (err) {
                if (err) {
                    throw err;
                }
            }, self = this;
            // the persistenceAdapter should be present if all is ok, but check to be sure.
            if (this.persistenceAdapter == null) {
                cbFunc(new Error("persistenceAdapter not configured"));
                return;
            }
            this.persistenceAdapter.loadDatabase(this.filename, function loadDatabaseCallback(dbString) {
                if (typeof dbString === "string") {
                    self.loadJSON(dbString, db, options != null ? options : {});
                    cbFunc(null);
                }
                else {
                    console.warn("loadDatabase(): Database not found");
                    if (typeof dbString === "object") {
                        cbFunc("database string cannot be an object: " + dbString);
                    }
                    else {
                        cbFunc("Database not found");
                    }
                }
            });
        };
        /** allows reconfiguring database options
         *
         * @param options - configuration options to apply to MemDb db object
         * @param initialConfig - (optional) if this is a reconfig, don't pass this
         */
        DbPersister.prototype.configurePersistence = function (db, options, initialConfig) {
            var defaultPersistence = {
                "NODEJS": "fs",
                "BROWSER": "localStorage",
                "CORDOVA": "localStorage"
            };
            var persistenceMethods = {
                "fs": MemDbFsAdapter,
                "localStorage": MemDbLocalStorageAdapter
            };
            this.persistenceMethod = null;
            // retain reference to optional persistence adapter 'instance'
            // currently keeping outside options because it can't be serialized
            this.persistenceAdapter = null;
            // process the options
            if (options !== undefined) {
                if (options.persistenceMethod != null) {
                    // check if the specified persistence method is known
                    if (typeof persistenceMethods[options.persistenceMethod] == "function") {
                        this.persistenceMethod = options.persistenceMethod;
                        this.persistenceAdapter = new persistenceMethods[options.persistenceMethod]();
                    }
                    // should be throw an error here, or just fall back to defaults ??
                }
                // if user passes adapter, set persistence mode to adapter and retain persistence adapter instance
                if (options.adapter != null) {
                    this.persistenceMethod = "adapter";
                    this.persistenceAdapter = options.adapter;
                }
                // if they want to load database on db instantiation, now is a good time to load... after adapter set and before possible autosave initiation
                if (options.autoload && initialConfig) {
                    // for autoload, let the constructor complete before firing callback
                    var self = this;
                    setTimeout(function () {
                        self.loadDatabase(db, options, options.autoloadCallback);
                    }, 1);
                }
                if (options.autosaveInterval != null) {
                    this.autosaveDisable();
                    this.autosaveInterval = parseInt(options.autosaveInterval, 10);
                }
                if (options.autosave) {
                    this.autosaveDisable();
                    this.autosave = true;
                    this.autosaveEnable();
                }
            }
            // if by now there is no adapter specified by user nor derived from persistenceMethod: use sensible defaults
            if (this.persistenceAdapter === null) {
                this.persistenceMethod = defaultPersistence[db.environment];
                if (this.persistenceMethod) {
                    this.persistenceAdapter = new persistenceMethods[this.persistenceMethod]();
                }
            }
        };
        /** Handles saving to file system, local storage, or adapter (indexeddb)
         *    This method utilizes MemDb configuration options (if provided) to determine which
         *    persistence method to use, or environment detection (if configuration was not provided).
         *
         * @param options - not currently used (remove or allow overrides?)
         * @param callback - (Optional) user supplied async callback / error handler
         */
        DbPersister.prototype.saveDatabase = function (callback) {
            var self = this;
            var cbFunc = callback || function (err) {
                if (err) {
                    throw err;
                }
            };
            // the persistenceAdapter should be present if all is ok, but check to be sure.
            if (this.persistenceAdapter !== null) {
                this.persistenceAdapter.saveDatabase(this.filename, self.serialize(), function saveDatabaseCallback() {
                    // for now assume that save went ok and reset dirty flags
                    // in future we may move this into each if block if no exceptions occur.
                    self.autosaveClearFlags();
                    cbFunc(null);
                });
            }
            else {
                cbFunc(new Error("persistenceAdapter not configured"));
            }
        };
        /** check whether any collections are 'dirty' meaning we need to save (entire) database
         *
         * @returns true if database has changed since last autosave, false if not.
         */
        DbPersister.prototype.autosaveDirty = function () {
            var colls = this.getCollections();
            for (var idx = 0; idx < colls.length; idx++) {
                if (colls[idx].dirty) {
                    return true;
                }
            }
            return false;
        };
        /** resets dirty flags on all collections.
         *    Called from saveDatabase() after db is saved.
         */
        DbPersister.prototype.autosaveClearFlags = function () {
            var colls = this.getCollections();
            for (var idx = 0; idx < colls.length; idx++) {
                colls[idx].dirty = false;
            }
        };
        /** begin a javascript interval to periodically save the database.
         */
        DbPersister.prototype.autosaveEnable = function () {
            this.autosave = true;
            var delay = 5000, self = this;
            if (this.autosaveInterval != null) {
                delay = this.autosaveInterval;
            }
            this.autosaveHandle = setInterval(function autosaveHandleInterval() {
                // use of dirty flag will need to be hierarchical since mods are done at collection level with no visibility of 'db'
                // so next step will be to implement collection level dirty flags set on insert/update/remove
                // along with db level isDirty() function which iterates all collections to see if any are dirty
                if (self.autosaveDirty()) {
                    self.saveDatabase();
                }
            }, delay);
        };
        /** stop the autosave interval timer.
         */
        DbPersister.prototype.autosaveDisable = function () {
            if (this.autosaveHandle != null) {
                clearInterval(this.autosaveHandle);
                this.autosaveHandle = null;
            }
        };
        /** used to prevent certain properties from being serialized
         */
        DbPersister.prototype.serializeReplacer = function (key, value) {
            switch (key) {
                case "autosaveHandle":
                case "persistenceAdapter":
                case "constraints":
                    return null;
                default:
                    return value;
            }
        };
        // toJson
        DbPersister.prototype.serialize = function () {
            return JSON.stringify(this, this.serializeReplacer);
        };
        /** inflates a MemDb database from a serialized JSON string
         *
         * @param serializedDb - a serialized MemDb database string
         * @param options - apply or override collection level settings
         */
        DbPersister.prototype.loadJSON = function (serializedDb, db, options) {
            var obj = JSON.parse(serializedDb);
            db.name = obj.name;
            db.databaseVersion = (obj.databaseVersion != null ? obj.databaseVersion : 1.0);
            db.collections = [];
            for (var i = 0, len = obj.collections.length; i < len; i++) {
                var coll = obj.collections[i];
                var copyColl = db.addCollection(coll.name);
                // load each element individually
                var clen = coll.data.length;
                var j = 0;
                if (options && options.hasOwnProperty(coll.name)) {
                    var collOpts = options[coll.name];
                    var loader = collOpts.inflate != null ? collOpts.inflate : copyProps;
                    for (j; j < clen; j++) {
                        var collObj = new (collOpts.proto)();
                        loader(coll.data[j], collObj);
                        copyColl.data[j] = collObj;
                    }
                }
                else {
                    for (j; j < clen; j++) {
                        copyColl.data[j] = coll.data[j];
                    }
                }
                copyColl.transactional = coll.transactional;
                copyColl.disableChangesApi = coll.disableChangesApi;
                copyColl.cloneObjects = coll.cloneObjects;
                copyColl.maxId = (coll.data.length === 0) ? 0 : coll.maxId;
                copyColl.idIndex = coll.idIndex;
                if (coll.binaryIndices !== undefined) {
                    copyColl.binaryIndices = coll.binaryIndices;
                }
                copyColl.ensureId();
                // in case they are loading a database created before we added dynamic views, handle undefined
                if (coll.dynamicViews === undefined)
                    continue;
                // reinflate DynamicViews and attached Resultsets
                var dvCount = coll.dynamicViews.length;
                if (dvCount < 1)
                    continue;
                if (!options || !options.createDynamicView) {
                    throw new Error("collection '" + coll.name + "' has " + dvCount + " dynamic views but no 'options.createDynamicView' function provided");
                }
                for (var idx = 0; idx < dvCount; idx++) {
                    var colldv = coll.dynamicViews[idx];
                    var dv = copyColl.addDynamicView(options.createDynamicView(coll, colldv));
                    dv.resultdata = colldv.resultdata;
                    dv.resultsdirty = colldv.resultsdirty;
                    dv.filterPipeline = colldv.filterPipeline;
                    dv.sortCriteria = colldv.sortCriteria;
                    dv.sortFunction = null;
                    dv.sortDirty = colldv.sortDirty;
                    dv.resultset.filteredrows = colldv.resultset.filteredrows;
                    dv.resultset.searchIsChained = colldv.resultset.searchIsChained;
                    dv.resultset.filterInitialized = colldv.resultset.filterInitialized;
                    dv.rematerialize({ removeWhereFilters: true });
                }
            }
        };
        return DbPersister;
    }());
    MemDbPersisters.DbPersister = DbPersister;
    /**
     * constructor for fs
     */
    var MemDbFsAdapter = (function () {
        function MemDbFsAdapter() {
            this.fs = require("fs");
        }
        /** Load data from file, will throw an error if the file does not exist
         * @param dbname - the filename of the database to load
         * @param callback - the callback to handle the result
         */
        MemDbFsAdapter.prototype.loadDatabase = function (dbname, callback) {
            this.fs.readFile(dbname, {
                encoding: "utf8"
            }, function readFileCallback(err, data) {
                if (err) {
                    callback(new Error(err));
                }
                else {
                    callback(data);
                }
            });
        };
        /** save data to file, will throw an error if the file can't be saved
         * might want to expand this to avoid dataloss on partial save
         * @param dbname - the filename of the database to load
         * @param callback - the callback to handle the result
         */
        MemDbFsAdapter.prototype.saveDatabase = function (dbname, dbstring, callback) {
            this.fs.writeFile(dbname, dbstring, callback);
        };
        return MemDbFsAdapter;
    }());
    MemDbPersisters.MemDbFsAdapter = MemDbFsAdapter;
    /**
     * constructor for local storage
     */
    var MemDbLocalStorageAdapter = (function () {
        function MemDbLocalStorageAdapter() {
        }
        /** Load data from localstorage
         * @param dbname - the name of the database to load
         * @param callback - the callback to handle the result
         */
        MemDbLocalStorageAdapter.prototype.loadDatabase = function (dbname, callback) {
            if (localStorageAvailable()) {
                callback(localStorage.getItem(dbname));
            }
            else {
                callback(new Error("localStorage is not available"));
            }
        };
        /** save data to localstorage, will throw an error if the file can't be saved
         * might want to expand this to avoid dataloss on partial save
         * @param dbname - the filename of the database to load
         * @param callback - the callback to handle the result
         */
        MemDbLocalStorageAdapter.prototype.saveDatabase = function (dbname, dbstring, callback) {
            if (localStorageAvailable()) {
                localStorage.setItem(dbname, dbstring);
                callback(null);
            }
            else {
                callback(new Error("localStorage is not available"));
            }
        };
        return MemDbLocalStorageAdapter;
    }());
    MemDbPersisters.MemDbLocalStorageAdapter = MemDbLocalStorageAdapter;
    function localStorageAvailable() {
        try {
            return ("localStorage" in window && window.localStorage !== null);
        }
        catch (e) {
            return false;
        }
    }
    function copyProps(src, dest) {
        for (var prop in src) {
            dest[prop] = src[prop];
        }
    }
})(MemDbPersisters || (MemDbPersisters = {}));
module.exports = MemDbPersisters;
