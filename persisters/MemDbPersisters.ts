declare var window: { localStorage: any };

/**-----------------+
 | PERSISTENCE      |
 -------------------*
 * there are two build in persistence adapters for internal use
 * fs             for use in Nodejs type environments
 * localStorage   for use in browser environment
 * defined as helper classes here so its easy and clean to use
 */
module MemDbPersisters {

    export interface MemDbConfigureOptions {
        env?: ("BROWSER" | "CORDOVA" | "NODEJS");
        persistenceMethod?: string/*'fs', 'localStorage'*/;
        adapter?: MemDbPersistenceInterface;
        autoload?: any;
        autoloadCallback?: (err: string | Error | null) => void;
        autosave?: boolean;
        autosaveInterval?: number;
        createDynamicView?: (coll: MemDbCollection<any>, dv: MemDbDynamicView<any>) => MemDbDynamicView<any>;
    }


    export var localStorage = (typeof window !== "undefined" && "localStorage" in window && window.localStorage !== null ? window.localStorage : null);


    export class DbPersister {
        autosave: boolean;
        autosaveHandle: number | null;
        autosaveInterval: number;
        filename: string;
        persistenceAdapter: MemDbPersistenceInterface | null;
        persistenceMethod: string | null;
        getCollections: () => MemDbCollection<any>[]


        constructor(filename: string, getCollections: () => MemDbCollection<any>[]) {
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
        public loadDatabase(db: InMemDb, options?: { createDynamicView?: (coll: MemDbCollection<any>, dv: MemDbDynamicView<any>) => MemDbDynamicView<any> }, callback?: (err: string | Error | null) => void) {
            var cbFunc = callback || function (err: string | Error | null) {
                if (err) {
                    throw err;
                }
            },
                self = this;

            // the persistenceAdapter should be present if all is ok, but check to be sure.
            if (this.persistenceAdapter == null) {
                cbFunc(new Error("persistenceAdapter not configured"));
                return;
            }

            this.persistenceAdapter.loadDatabase(this.filename, function loadDatabaseCallback(dbString) {
                if (typeof dbString === "string") {
                    self.loadJSON(dbString, db, options != null ? options : <any>{});
                    cbFunc(null);
                }
                else {
                    console.warn("loadDatabase(): Database not found");
                    if (typeof dbString === "object") {
                        cbFunc("database string cannot be an object: " + dbString);
                    } else {
                        cbFunc("Database not found");
                    }
                }
            });
        }


        /** allows reconfiguring database options
         *
         * @param options - configuration options to apply to MemDb db object
         * @param initialConfig - (optional) if this is a reconfig, don't pass this
         */
        public configurePersistence(db: InMemDb, options: MemDbConfigureOptions | undefined, initialConfig?: boolean) {
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
                    if (typeof (<any>persistenceMethods)[options.persistenceMethod] == "function") {
                        this.persistenceMethod = options.persistenceMethod;
                        this.persistenceAdapter = new (<any>(<any>persistenceMethods)[options.persistenceMethod])();
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
                    this.autosaveInterval = parseInt(<any>options.autosaveInterval, 10);
                }

                if (options.autosave) {
                    this.autosaveDisable();
                    this.autosave = true;
                    this.autosaveEnable();
                }
            }

            // if by now there is no adapter specified by user nor derived from persistenceMethod: use sensible defaults
            if (this.persistenceAdapter === null) {
                this.persistenceMethod = (<any>defaultPersistence)[db.environment];
                if (this.persistenceMethod) {
                    this.persistenceAdapter = new (<any>(<any>persistenceMethods)[this.persistenceMethod])();
                }
            }
        }


        /** Handles saving to file system, local storage, or adapter (indexeddb)
         *    This method utilizes MemDb configuration options (if provided) to determine which
         *    persistence method to use, or environment detection (if configuration was not provided).
         *
         * @param options - not currently used (remove or allow overrides?)
         * @param callback - (Optional) user supplied async callback / error handler
         */
        public saveDatabase(callback?: (err: any) => void) {
            var self = this;
            var cbFunc = callback || function (err: any) {
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
            } else {
                cbFunc(new Error("persistenceAdapter not configured"));
            }

        }

        // alias
        public save = DbPersister.prototype.saveDatabase;


        /** check whether any collections are 'dirty' meaning we need to save (entire) database
         *
         * @returns true if database has changed since last autosave, false if not.
         */
        public autosaveDirty() {
            var colls = this.getCollections();
            for (var idx = 0; idx < colls.length; idx++) {
                if (colls[idx].dirty) {
                    return true;
                }
            }

            return false;
        }


        /** resets dirty flags on all collections.
         *    Called from saveDatabase() after db is saved.
         */
        public autosaveClearFlags() {
            var colls = this.getCollections();
            for (var idx = 0; idx < colls.length; idx++) {
                colls[idx].dirty = false;
            }
        }


        /** begin a javascript interval to periodically save the database.
         */
        public autosaveEnable() {
            this.autosave = true;

            var delay = 5000,
                self = this;

            if (this.autosaveInterval != null) {
                delay = this.autosaveInterval;
            }

            this.autosaveHandle = <any>setInterval(function autosaveHandleInterval() {
                // use of dirty flag will need to be hierarchical since mods are done at collection level with no visibility of 'db'
                // so next step will be to implement collection level dirty flags set on insert/update/remove
                // along with db level isDirty() function which iterates all collections to see if any are dirty

                if (self.autosaveDirty()) {
                    self.saveDatabase();
                }
            }, delay);
        }


        /** stop the autosave interval timer.
         */
        public autosaveDisable() {
            if (this.autosaveHandle != null) {
                clearInterval(<any>this.autosaveHandle);
                this.autosaveHandle = null;
            }
        }


        /** used to prevent certain properties from being serialized
         */
        public serializeReplacer<T>(key: string, value: T): T | null {
            switch (key) {
                case "autosaveHandle":
                case "persistenceAdapter":
                case "constraints":
                    return null;
                default:
                    return value;
            }
        }


        // toJson
        public serialize() {
            return JSON.stringify(this, this.serializeReplacer);
        }

        // alias of serialize
        public toJson = DbPersister.prototype.serialize;


        /** inflates a MemDb database from a serialized JSON string
         *
         * @param serializedDb - a serialized MemDb database string
         * @param options - apply or override collection level settings
         */
        public loadJSON(serializedDb: string, db: { name: string; databaseVersion: number; collections: MemDbCollection<any>[]; addCollection: (name: string) => MemDbCollection<any> },
                options: { createDynamicView?: (coll: MemDbCollection<any>, cdv: MemDbDynamicView<any>) => MemDbDynamicView<any>; } & { [collectionName: string]: { inflate?: (doc: any, coll: any) => void; proto: new () => any } }) {
            var obj = JSON.parse(serializedDb);

            db.name = obj.name;
            db.databaseVersion = (obj.databaseVersion != null ? obj.databaseVersion : 1.0);
            db.collections = [];

            for (var i = 0, len = obj.collections.length; i < len; i++) {
                var coll: MemDbCollection<any> = obj.collections[i];
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
                } else {
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
                if (coll.dynamicViews === undefined) continue;

                // reinflate DynamicViews and attached Resultsets
                var dvCount = coll.dynamicViews.length;
                if (dvCount < 1) continue;

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
        }

    }




    /**
     * constructor for fs
     */
    export class MemDbFsAdapter {
        fs: any;

        constructor() {
            this.fs = require("fs");
        }


        /** Load data from file, will throw an error if the file does not exist
         * @param dbname - the filename of the database to load
         * @param callback - the callback to handle the result
         */
        public loadDatabase(dbname: string, callback: (dataOrError: string | Error) => void) {
            this.fs.readFile(dbname, {
                encoding: "utf8"
            }, function readFileCallback(err: Error, data: string) {
                if (err) {
                    callback(err);
                } else {
                    callback(data);
                }
            });
        }


        /** save data to file, will throw an error if the file can't be saved
         * might want to expand this to avoid dataloss on partial save
         * @param dbname - the filename of the database to load
         * @param callback - the callback to handle the result
         */
        public saveDatabase(dbname: string, dbstring: string, callback: (...args: any[]) => any) {
            this.fs.writeFile(dbname, dbstring, callback);
        }

    }




    /**
     * constructor for local storage
     */
    export class MemDbLocalStorageAdapter {

        constructor() { }

        /** Load data from localstorage
         * @param dbname - the name of the database to load
         * @param callback - the callback to handle the result
         */
        public loadDatabase(dbname: string, callback: (obj: any) => void) {
            if (localStorage != null) {
                callback(localStorage.getItem(dbname));
            } else {
                callback(new Error("localStorage is not available"));
            }
        }


        /** save data to localstorage, will throw an error if the file can't be saved
         * might want to expand this to avoid dataloss on partial save
         * @param dbname - the filename of the database to load
         * @param callback - the callback to handle the result
         */
        public saveDatabase(dbname: string, dbstring: string, callback: (obj: any) => void) {
            if (localStorage != null) {
                localStorage.setItem(dbname, dbstring);
                callback(null);
            } else {
                callback(new Error("localStorage is not available"));
            }
        }

    }



    function copyProps(src: object, dest: object) {
        for (var prop in src) {
            (<any>dest)[prop] = (<any>src)[prop];
        }
    }

}

export = MemDbPersisters;