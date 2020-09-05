import EventEmitter = require("./TsEventEmitter");
import Resultset = require("./Resultset");

/** Collection class that handles documents of same type
 */
class Collection<T> implements MemDbCollection<T> {
    name: string;
    data: (T & MemDbObj)[];
    binaryIndices: { [P in keyof T]: MemDbCollectionIndex };
    constraints: {
        unique: { [P in keyof T]: UniqueIndex<T & MemDbObj> };
        exact: { [P in keyof T]: ExactIndex<T> };
    };
    events: TsEventEmitter<{
        'insert': any[];
        'update': any[];
        'pre-insert': any[];
        'pre-update': any[];
        'error': any[];
        'delete': any[];
        'warning': any[];
    }>;
    dynamicViews: MemDbDynamicView<T>[];
    idIndex: number[];
    dirty: boolean;
    cachedIndex: number[] | null;
    cachedBinaryIndex: { [P in keyof T]: MemDbCollectionIndex } | null;
    cachedData: (T & MemDbObj)[] | null;
    maxId: number;
    changes: MemDbCollectionChange[];
    transactional: boolean;
    cloneObjects: boolean;
    disableChangesApi: boolean;

    setChangesApi: (enabled: boolean) => void;
    getChanges: () => MemDbCollectionChange[];
    flushChanges: () => void;


    /**
     * @param name collection name
     * @param options configuration object
     */
    constructor(name: string, options?: MemDbCollectionOptions<T> | null) {
        // the name of the collection
        this.name = name;
        // the data held by the collection
        this.data = [];
        this.idIndex = []; // index of id
        this.binaryIndices = <any>{}; // user defined indexes
        this.constraints = {
            unique: <any>{},
            exact: <any>{}
        };

        // in autosave scenarios use collection level dirty flags to determine whether save is needed.
        // currently, if any collection is dirty we will autosave the whole database if autosave is configured.
        // defaulting to true since this is called from addCollection() and adding a collection should trigger save
        this.dirty = true;

        // private holders for cached data
        this.cachedIndex = null;
        this.cachedBinaryIndex = null;
        this.cachedData = null;
        var self = this;

        /* OPTIONS */
        options = options || {};

        // exact match and unique constraints
        if (options.unique != null) {
            if (!Array.isArray(options.unique)) {
                options.unique = [options.unique];
            }
            options.unique.forEach(function (prop) {
                self.constraints.unique[prop] = new UniqueIndex(prop);
            });
        }

        if (options.exact != null) {
            options.exact.forEach(function (prop) {
                self.constraints.exact[prop] = new ExactIndex(prop);
            });
        }

        // is collection transactional
        this.transactional = options.transactional != null ? options.transactional : false;

        // options to clone objects when inserting them
        this.cloneObjects = options.clone != null ? options.clone : false;

        // disable track changes
        this.disableChangesApi = options.disableChangesApi != null ? options.disableChangesApi : true;

        // currentMaxId - change manually at your own peril!
        this.maxId = 0;

        this.dynamicViews = [];

        // events
        this.events = new EventEmitter({
            "insert": [],
            "update": [],
            "pre-insert": [],
            "pre-update": [],
            "error": [],
            "delete": [],
            "warning": []
        });

        // changes are tracked by collection and aggregated by the db
        this.changes = [];

        // initialize the id index
        this.ensureId();
        var indices: (keyof T & string)[] = [];
        // initialize optional user-supplied indices array ['age', 'lname', 'zip']
        //if (typeof indices !== 'undefined') {
        if (options && options.indices) {
            if (Object.prototype.toString.call(options.indices) === "[object Array]") {
                indices = options.indices;
            } else {
                throw new TypeError("Indices must be a string or an array of strings");
            }
        }

        for (var idx = 0; idx < indices.length; idx++) {
            this.ensureIndex(indices[idx]);
        }

        /** This method creates a clone of the current status of an object and associates operation and collection name,
         * so the parent db can aggregate and generate a changes object for the entire db
         */
        function createChange(name: string, op: ("I" | "U" | "R"), obj: any) {
            self.changes.push({
                name: name,
                operation: op,
                obj: JSON.parse(JSON.stringify(obj))
            });
        }

        this.getChanges = function getChanges() {
            return self.changes;
        };

        // clear all the changes
        this.flushChanges = function flushChanges() {
            self.changes = [];
        };

        /** If the changes API is disabled make sure only metadata is added without re-evaluating everytime if the changesApi is enabled
         */
        function insertMeta(obj: MemDbObj | null | undefined) {
            if (obj == null) { return; }

            if (obj.meta == null) {
                obj.meta = {
                    created: (new Date()).getTime(),
                    revision: 0,
                };
            }
            else {
                obj.meta.created = (new Date()).getTime();
                obj.meta.revision = 0;
            }
        }

        function updateMeta(obj: MemDbObj | null | undefined) {
            if (obj == null) { return; }

            obj.meta.updated = (new Date()).getTime();
            obj.meta.revision += 1;
        }

        function insertMetaWithChange(obj: any) {
            insertMeta(obj);
            createChange(self.name, "I", obj);
        }

        function updateMetaWithChange(obj: any) {
            updateMeta(obj);
            createChange(self.name, "U", obj);
        }

        /* assign correct handler based on ChangesAPI flag */
        var insertHandler: (obj: any) => void = self.disableChangesApi ? insertMeta : insertMetaWithChange;
        var updateHandler: (obj: any) => void = self.disableChangesApi ? updateMeta : updateMetaWithChange;

        this.setChangesApi = function setChangesApi(enabled: boolean) {
            self.disableChangesApi = !enabled;
            insertHandler = self.disableChangesApi ? insertMeta : insertMetaWithChange;
            updateHandler = self.disableChangesApi ? updateMeta : updateMetaWithChange;
        };

        // built-in events
        this.events.on("insert", function insertCallback(obj) {
            insertHandler(obj);
        });

        this.events.on("update", function updateCallback(obj) {
            updateHandler(obj);
        });

        this.events.on("delete", function deleteCallback(obj) {
            if (!self.disableChangesApi) {
                createChange(self.name, "R", obj);
            }
        });

        this.events.on("warning", console.warn);
        // for de-serialization purposes
        this.flushChanges();
    }


    /*----------------------------+
    | INDEXING                    |
    +----------------------------*/

    /** Ensure binary index on a certain field
     */
    public ensureIndex(prop: keyof T & string, force: boolean = false) {
        if (prop == null) {
            throw new Error("Attempting to set index without an associated property");
        }

        var index = this.binaryIndices[prop];

        if (this.binaryIndices.hasOwnProperty(prop) && !force) {
            if (!index.dirty) return;
        }

        index = this.binaryIndices[prop] = {
            name: prop,
            dirty: true,
            values: []
        };

        // initialize index values
        for (var i = 0, len = this.data.length; i < len; i++) {
            index.values.push(i);
        }

        var coll = this;
        function comparer(a: number, b: number) {
            var prop1 = coll.data[a][prop];
            var prop2 = coll.data[b][prop];

            if (prop1 === prop2) return 0;
            //if (gtHelper(prop1, prop2)) return 1;
            //if (ltHelper(prop1, prop2)) return -1;
            if (prop2 == null) return 1;
            if (prop1 == null) return -1;
            return (prop1 > prop2 ? 1 : -1);
        };

        index.values.sort(comparer);
        index.dirty = false;

        this.dirty = true; // for autosave scenarios
    }


    public ensureUniqueIndex(field: keyof T & string) {
        var index = this.constraints.unique[field];
        if (!index) {
            index = this.constraints.unique[field] = new UniqueIndex(field);
        }
        this.data.forEach(function (obj) {
            index.set(obj);
        });
    }


    /** Ensure all binary indices
     */
    public ensureAllIndexes(force?: boolean) {
        var objKeys = <(keyof T & string)[]>Object.keys(this.binaryIndices);

        var i = objKeys.length;
        while (i--) {
            this.ensureIndex(objKeys[i], force);
        }
    }


    public flagBinaryIndexesDirty(objKeys?: string[] | null) {
        objKeys = objKeys || Object.keys(this.binaryIndices);

        var i = objKeys.length;
        while (i--) {
            this.binaryIndices[<keyof T>objKeys[i]].dirty = true;
        }
    }


    public count() {
        return this.data.length;
    }


    /** Rebuild idIndex
     */
    public ensureId() {
        var len = this.data.length,
            i = 0;

        this.idIndex = [];
        for (i; i < len; i++) {
            this.idIndex.push(<number>this.data[i].$loki);
        }
    }


    /** Rebuild idIndex async with callback - useful for background syncing with a remote server
     */
    public ensureIdAsync(callback: () => void) {
        var self = this;
        this.async(function () {
            self.ensureId();
        }, callback);
    }


    /** Each collection maintains a list of DynamicViews associated with it
     */
    public addDynamicView(dv: MemDbDynamicView<T>) {
        this.dynamicViews.push(dv);
        return dv;
    }


    public removeDynamicView(name: string) {
        for (var idx = 0; idx < this.dynamicViews.length; idx++) {
            if (this.dynamicViews[idx].name === name) {
                var dvs = this.dynamicViews.splice(idx, 1);
                return dvs[0];
            }
        }
        return null;
    }


    public getDynamicView(name: string) {
        for (var idx = 0; idx < this.dynamicViews.length; idx++) {
            if (this.dynamicViews[idx].name === name) {
                return this.dynamicViews[idx];
            }
        }
        return null;
    }


    /** find and update: pass a filtering function to select elements to be updated
     * and apply the updatefunc to those elements iteratively
     */
    public findAndUpdate(filterFunc: (obj: T) => boolean, updateFunc: (obj: T) => T): void {
        var results = this.where(filterFunc);
        try {
            for (var i = 0; i < results.length; i++) {
                var obj = <T & MemDbObj>updateFunc(results[i]);
                this.update(obj);
            }
        } catch (err) {
            this.rollback();
            this.events.emit("error", err);
            throw err;
        }
    }


    /** insert document method - ensure objects have id and meta properties
     * @param the document to be inserted (or an array of objects)
     * @returns document or documents (if passed an array of objects)
     */
    public insert(doc: T): T;
    public insert(doc: T[]): T[];
    public insert(doc: T | T[]): T | T[] {
        if (!doc) {
            var error = new Error("Parameter 'doc' cannot be null");
            this.events.emit("error", error);
            throw error;
        }

        var self = this;
        // holder to the clone of the object inserted if collections is set to clone objects
        var docs = Array.isArray(doc) ? doc : [doc];
        var results: T[] = [];
        docs.forEach(function (d) {
            if (typeof d !== "object") {
                throw new TypeError("Document must be an object");
            }

            var obj = <T & MemDbObj>(self.cloneObjects ? JSON.parse(JSON.stringify(d)) : d);
            if (obj.meta === undefined) {
                obj.meta = {
                    revision: 0,
                    created: 0
                };
            }
            self.events.emit("pre-insert", obj);
            if (self.add(obj)) {
                self.events.emit("insert", obj);
                results.push(obj);
            }
            else {
                return;
            }
        });
        return results.length === 1 ? results[0] : results;
    }


    public clear() {
        this.data = [];
        this.idIndex = [];
        this.binaryIndices = <any>{};
        /* custom fix repopulating collection */
        var self = this;
        (<(keyof T)[]>Object.keys(this.constraints.unique)).forEach(function (prop) {
            self.constraints.unique[prop].clear();
        });
        (<(keyof T)[]>Object.keys(this.constraints.exact)).forEach(function (prop) {
            self.constraints.exact[prop].clear();
        });
        this.cachedIndex = null;
        this.cachedData = null;
        this.maxId = 0;
        this.dynamicViews = [];
        this.dirty = true;
    }


    /** Update method
     */
    public update(doc: T & MemDbObj) {
        var binaryIdxs = <(keyof T & string)[]>Object.keys(this.binaryIndices);
        if (binaryIdxs.length > 0) {
            this.flagBinaryIndexesDirty(binaryIdxs);
        }

        if (Array.isArray(doc)) {
            for (var k = 0, len = doc.length; k < len; k++) {
                this.update(doc[k]);
            }
            return;
        }

        // verify object is a properly formed document
        if (!doc.hasOwnProperty("$loki")) {
            throw new Error("Trying to update unsynced document. Save the document first by using insert()");
        }
        try {
            this.startTransaction();
            var arr: [T & MemDbObj, number] = this.get(<number>doc.$loki, true),
                self = this;

            if (!arr) {
                throw new Error("Trying to update a document not in collection.");
            }
            this.events.emit("pre-update", doc);

            var obj = arr[0];
            (<(keyof T)[]>Object.keys(this.constraints.unique)).forEach(function (key) {
                self.constraints.unique[key].update(obj);
            });
            // get current position in data array
            var position = arr[1];

            // operate the update
            this.data[position] = doc;

            // now that we can efficiently determine the data[] position of newly added document,
            // submit it for all registered DynamicViews to evaluate for inclusion/exclusion
            for (var idx = 0; idx < this.dynamicViews.length; idx++) {
                this.dynamicViews[idx].evaluateDocument(position);
            }

            this.idIndex[position] = <number>obj.$loki;

            this.commit();
            this.dirty = true; // for autosave scenarios
            this.events.emit("update", doc);
        } catch (err) {
            this.rollback();
            this.events.emit("error", err);
            throw err; // re-throw error so user does not think it succeeded
        }
    }


    /** Add object to collection
     */
    public add(obj: T & MemDbObj) {
        // if parameter isn't object exit with throw
        if (typeof obj !== "object") {
            throw new Error("Parameter 'obj' being added must be an object");
        }

        // try adding object to collection
        var binaryIdxs = Object.keys(this.binaryIndices);
        if (binaryIdxs.length > 0) {
            this.flagBinaryIndexesDirty();
        }

        // if object you are adding already has id column it is either already in the collection
        // or the object is carrying its own 'id' property.  If it also has a meta property,
        // then this is already in collection so throw error, otherwise rename to originalId and continue adding.
        if (obj.$loki !== undefined) {
            throw new Error("Document is already in collection, use update()");
        }

        try {
            this.startTransaction();
            this.maxId++;

            if (isNaN(this.maxId)) {
                this.maxId = (<number>this.data[this.data.length - 1].$loki + 1);
            }

            obj.$loki = this.maxId;

            // add the object
            this.data.push(obj);

            var self = this;
            (<(keyof T)[]>Object.keys(this.constraints.unique)).forEach(function (key) {
                self.constraints.unique[key].set(obj);
            });

            // submit the newly added document to all registered DynamicViews to evaluate for inclusion/exclusion
            var dvlen = this.dynamicViews.length;
            for (var i = 0; i < dvlen; i++) {
                this.dynamicViews[i].evaluateDocument(this.data.length - 1);
            }

            // add new obj id to idIndex
            this.idIndex.push(obj.$loki);

            this.commit();
            this.dirty = true; // for autosave scenarios
            return obj;
        } catch (err) {
            this.rollback();
            this.events.emit("error", err);
            throw err;
        }
    }


    public removeWhere(query: ((obj: T) => boolean) | MemDbQuery) {
        var list = (typeof query === "function" ? this.data.filter(<(obj: T & MemDbObj) => boolean>query) : Resultset.from<T>(this, query));

        var len = list.length;
        while (len--) {
            this.remove(list[len]);
        }

        for (var dv in this.dynamicViews) {
            this.dynamicViews[dv].rematerialize();
        }
    }


    public removeDataOnly() {
        this.removeWhere(function (obj) {
            return true;
        });
    }


    /** delete wrapped
     */
    public remove(doc: T | T[] | number | number[]): T | null {
        if (typeof doc === "number") {
            doc = this.get(doc);
        }

        if (typeof doc !== "object") {
            throw new TypeError("Parameter 'doc' is not an object");
        }
        if (Array.isArray(doc)) {
            for (var k = 0, len = doc.length; k < len; k++) {
                this.remove(doc[k]);
            }
            return null;
        }

        if (!(<any>doc).hasOwnProperty("$loki")) {
            throw new Error("Object is not a document stored in the collection");
        }

        var binaryIdxs = Object.keys(this.binaryIndices);
        if (binaryIdxs.length > 0) {
            this.flagBinaryIndexesDirty();
        }

        try {
            var item = <T & MemDbObj>doc;
            this.startTransaction();
            var arr = this.get(item.$loki, true),
                // obj = arr[0],
                position = arr[1];
            var self = this;
            (<(keyof T)[]>Object.keys(this.constraints.unique)).forEach(function (key) {
                self.constraints.unique[key].remove(<any>item[key]);
            });
            // now that we can efficiently determine the data[] position of newly added document,
            // submit it for all registered DynamicViews to remove
            for (var idx = 0; idx < this.dynamicViews.length; idx++) {
                this.dynamicViews[idx].removeDocument(position);
            }

            this.data.splice(position, 1);

            // remove id from idIndex
            this.idIndex.splice(position, 1);

            this.commit();
            this.dirty = true; // for autosave scenarios
            this.events.emit("delete", arr[0]);
            delete (<any>item).$loki;
            delete (<any>item).meta;
            return item;
        } catch (err) {
            this.rollback();
            this.events.emit("error", err);
            throw err;
        }
    }


    /*---------------------+
    | Finding methods     |
    +----------------------*/

    /** Get by Id - faster than other methods because of the searching algorithm
     */
    public get(id: number): T & MemDbObj;
    public get(id: number, returnPos: true): [T & MemDbObj, number];
    public get(id: number, returnPos?: boolean): (T & MemDbObj) | [T & MemDbObj, number];
    public get(id: number, returnPos?: boolean): (T & MemDbObj) | [T & MemDbObj, number] {

        var data = this.idIndex,
            max = data.length - 1,
            min = 0,
            mid = Math.floor(min + (max - min) / 2);

        if (isNaN(id)) {
            throw new TypeError("Parameter 'id' is not an integer: " + id);
        }

        while (data[min] < data[max]) {
            mid = Math.floor((min + max) / 2);

            if (data[mid] < id) {
                min = mid + 1;
            } else {
                max = mid;
            }
        }

        if (max === min && data[min] === id) {
            if (returnPos) {
                return [this.data[min], min];
            }
            return this.data[min];
        }
        // TODO should never happen, throw error
        return <never>null;
    }


    public by(field: keyof T): (value: any) => T | null;
    public by(field: keyof T, value: string): T | null;
    public by(field: keyof T, value?: string): T | null | ((value: any) => T | null);
    public by(field: keyof T, value?: string): T | null | ((value: any) => T | null) {
        if (!value) {
            var self = this;
            return function byProxy(value: any) {
                return self.by(field, value);
            };
        }
        return this.constraints.unique[field].get(value);
    }


    /** Chain method, used for beginning a series of chained find() and/or view() operations
     * on a collection.
     */
    public chain(): Resultset<T> {
        // TODO <any> cast fix for TS 3.2 vs 3.5 when imported into another project
        return <any>Resultset.from<T>(this, null, null);
    }


    /** Find one object by index property, by property equal to value
     */
    public findOne(query: MemDbQuery): (T & MemDbObj) | null {
        // Instantiate Resultset and exec find op passing firstOnly = true param
        var res: T & MemDbObj = Resultset.from<T>(this, query, null, true);
        if (Array.isArray(res) && res.length === 0) {
            return null;
        }
        else {
            return res;
        }
    }


    /** Find method, api is similar to mongodb except for now it only supports one search parameter.
     * for more complex queries use view() and storeView()
     */
    public find(query?: MemDbQuery): (T & MemDbObj)[] {
        if (query === undefined) {
            query = "getAll";
        }
        // find logic moved into Resultset class
        var resSet = Resultset.from<T>(this, query, null);
        return resSet;
    }


    /** Find object by unindexed property equal to the specified value.
     * Simply iterates and returns the first element matching the query
     */
    public findOneUnindexed(prop: string, value: any): (T & MemDbObj) | null {
        var ary = this.data;
        for (var i = 0, len = ary.length; i < len; i++) {
            if ((<any>ary[i])[prop] === value) {
                return ary[i];
            }
        }
        return null;
    }


    /**
     * Transaction methods
     */

    /** start the transation */
    public startTransaction() {
        if (this.transactional) {
            this.cachedData = clone(this.data, "parse-stringify");
            this.cachedIndex = this.idIndex;
            this.cachedBinaryIndex = this.binaryIndices;

            // propagate startTransaction to dynamic views
            for (var idx = 0; idx < this.dynamicViews.length; idx++) {
                this.dynamicViews[idx].startTransaction();
            }
        }
    }


    /** commit the transation */
    public commit() {
        if (this.transactional) {
            this.cachedData = null;
            this.cachedIndex = null;

            // propagate commit to dynamic views
            for (var idx = 0; idx < this.dynamicViews.length; idx++) {
                this.dynamicViews[idx].commit();
            }
        }
    }


    /** roll back the transation */
    public rollback() {
        if (this.transactional) {
            if (this.cachedData !== null && this.cachedIndex !== null && this.cachedBinaryIndex !== null) {
                this.data = this.cachedData;
                this.idIndex = this.cachedIndex;
                this.binaryIndices = this.cachedBinaryIndex;
            }

            // propagate rollback to dynamic views
            for (var idx = 0; idx < this.dynamicViews.length; idx++) {
                this.dynamicViews[idx].rollback();
            }
        }
    }


    // async executor. This is only to enable callbacks at the end of the execution.
    public async(func: () => void, callback: () => void) {
        setTimeout(function () {
            if (typeof func === "function") {
                func();
                callback();
            }
            else {
                throw new TypeError("Parameter 'func' is not a function");
            }
        }, 0);
    }


    /** Create view function - filter
     */
    public where(): Resultset<T>;
    public where(func: (obj: T) => boolean): (T & MemDbObj)[];
    public where(func?: (obj: T) => boolean): (T & MemDbObj)[] | Resultset<T>;
    public where(func?: (obj: T) => boolean): (T & MemDbObj)[] | Resultset<T> {
        // find logic moved into Resultset class
        var resSet = Resultset.from<T>(this, null, func);
        return resSet;
    }


    /* -------- STAGING API -------- */

    /**
     * stages: a map of uniquely identified 'stages', which hold copies of objects to be
     * manipulated without affecting the data in the original collection
     */
    public stages: { [name: string]: object } = {};


    /** create a stage and/or retrieve it
     */
    public getStage(name: string) {
        if (!this.stages[name]) {
            this.stages[name] = {};
        }
        return this.stages[name];
    }


    /** a collection of objects recording the changes applied through a commmitStage
     */
    public commitLog: { timestamp: number; message: any; data: any; }[] = [];


    /** create a copy of an object and insert it into a stage
     */
    public stage(stageName: string, obj: T & MemDbObj): T & MemDbObj {
        var copy = JSON.parse(JSON.stringify(obj));
        (<any>this.getStage(stageName))[obj.$loki] = copy;
        return copy;
    }


    /** re-attach all objects to the original collection, so indexes and views can be rebuilt
     * then create a message to be inserted in the commitlog
     */
    public commitStage(stageName: string, message: any) {
        var stage = this.getStage(stageName),
            timestamp = new Date().getTime();

        for (var prop in stage) {
            this.update((<any>stage)[prop]);
            this.commitLog.push({
                timestamp: <number>timestamp,
                message: message,
                data: JSON.parse(JSON.stringify((<any>stage)[prop]))
            });
        }
        this.stages[stageName] = {};
    }


    public extract<K extends keyof T>(field: K) {
        var result: T[K][] = [];
        for (var i = 0, len = this.data.length; i < len; i++) {
            result.push(this.data[i][field]);
        }
        return result;
    }


    public max<K extends keyof T>(field: K): T[K] {
        return <any>Math.max.apply(null, <any[]>this.extract(field));
    }


    public min<K extends keyof T>(field: K): T[K] {
        return <any>Math.min.apply(null, <any[]>this.extract(field));
    }


    public maxRecord<K extends keyof T>(field: K) {
        var i = 0,
            len = this.data.length,
            result = {
                index: 0,
                value: <T[K] | undefined>undefined
            },
            max: T[K] | undefined;

        for (i; i < len; i++) {
            if (max !== undefined) {
                if (max < this.data[i][field]) {
                    max = this.data[i][field];
                    result.index = this.data[i].$loki;
                }
            } else {
                max = this.data[i][field];
                result.index = this.data[i].$loki;
            }
        }
        result.value = max;
        return result;
    }


    public minRecord<K extends keyof T>(field: K) {
        var i = 0,
            len = this.data.length,
            result = {
                index: 0,
                value: <T[K] | undefined>undefined
            },
            min: T[K] | undefined;

        for (i; i < len; i++) {
            if (min !== undefined) {
                if (min > this.data[i][field]) {
                    min = this.data[i][field];
                    result.index = this.data[i].$loki;
                }
            }
            else {
                min = this.data[i][field];
                result.index = this.data[i].$loki;
            }
        }
        result.value = min;
        return result;
    }


    public extractNumerical<K extends keyof T>(field: K) {
        return this.extract(field).map(_parseFloat).filter(function (n) {
            return Number(n) && !isNaN(n);
        });
    }


    public avg<K extends keyof T>(field: K) {
        return average(this.extractNumerical(field));
    }


    public stdDev<K extends keyof T>(field: K) {
        return standardDeviation(this.extractNumerical(field));
    }


    public mode<K extends keyof T>(field: K) {
        var dict: { [value: string]: number } = {},
            values = <(string | number)[]><any[]>this.extract(field);
        values.forEach(function (v) {
            if (dict[v]) {
                dict[v] += 1;
            } else {
                dict[v] = 1;
            }
        });
        var max: number | undefined,
            mode: string | undefined;
        for (var prop in dict) {
            if (max) {
                if (max < dict[prop]) {
                    mode = prop;
                }
            }
            else {
                mode = prop;
                max = dict[prop];
            }
        }
        return mode;
    }


    public median<K extends keyof T>(field: K): number | undefined {
        var values = this.extractNumerical(field);
        values.sort(sub);

        var half = Math.floor(values.length / 2);

        if (values.length % 2) {
            return values[half];
        } else {
            return (values[half - 1] + values[half]) / 2.0;
        }
    }

}


class UniqueIndex<E extends MemDbObj> implements MemDbUniqueIndex<E> {
    keyMap: { [key: string]: E | undefined } = {};
    lokiMap: { [id: number]: any } = {};
    field: keyof E;

    constructor(uniqueField: keyof E) {
        this.field = uniqueField;
        this.keyMap = {};
        this.lokiMap = {};
    }

    public set(obj: E) {
        var field = this.field;
        if (this.keyMap[<any>obj[field]]) {
            throw new Error("Duplicate key for property " + field + ": " + obj[field]);
        }
        else {
            this.keyMap[<any>obj[field]] = obj;
            this.lokiMap[obj.$loki] = obj[field];
        }
    }

    public get(key: string) {
        return this.keyMap[key] || null;
    }

    public byId(id: number): E {
        return <E>this.keyMap[this.lokiMap[id]];
    }

    public update(obj: E) {
        var field = this.field;
        if (this.lokiMap[obj.$loki] !== obj[field]) {
            var old = this.lokiMap[obj.$loki];
            this.set(obj);
            // make the old key fail bool test, while avoiding the use of delete (mem-leak prone)
            this.keyMap[<string>old] = undefined;
        }
        else {
            this.keyMap[<any>obj[field]] = obj;
        }
    }

    public remove(key: string) {
        var obj = this.keyMap[key];
        if (obj != null) {
            this.keyMap[key] = undefined;
            this.lokiMap[obj.$loki] = undefined;
        }
        else {
            throw new Error("could not find index ID for key '" + key + "'");
        }
    }

    public clear() {
        this.keyMap = {};
        this.lokiMap = {};
    }
}


class ExactIndex<E> implements MemDbExactIndex<E> {
    index: { [key: string]: E[] | undefined };
    field: string;

    constructor(exactField: string) {
        this.index = {};
        this.field = exactField;
    }

    // add the value you want returned to the key in the index 
    public set(key: string, val: E) {
        var ix = this.index[key];
        if (ix) {
            ix.push(val);
        } else {
            this.index[key] = [val];
        }
    }

    // remove the value from the index, if the value was the last one, remove the key
    public remove(key: string, val: E) {
        var ixSet = this.index[key];
        if (ixSet == null) {
            throw new Error("could not find index ID for key '" + key + "'");
        }
        for (var i in ixSet) {
            if (ixSet[i] == val) {
                ixSet.splice(<number><any>i, 1);
            }
        }
        if (ixSet.length < 1) {
            this.index[key] = undefined;
        }
    }

    // get the values related to the key, could be more than one
    public get(key: string) {
        return this.index[key] || null;
    }

    // clear will zap the index
    public clear() {
        this.index = {};
    }
}


/**
 * General utils, including statistical functions
 */

function _parseFloat(num: any) {
    return parseFloat(num);
}

function add(a: any, b: any) {
    return a + b;
}

function sub(a: any, b: any) {
    return a - b;
}

function median(values: any[]) {
    values.sort(sub);
    var half = Math.floor(values.length / 2);
    return (values.length % 2) ? values[half] : ((values[half - 1] + values[half]) / 2.0);
}

function average(array: any[]) {
    return array.reduce(add, 0) / array.length;
}

function standardDeviation(values: any[]) {
    var avg = average(values);
    var squareDiffs = values.map(function (value) {
        var diff = value - avg;
        return diff * diff;
    });

    var avgSquareDiff = average(squareDiffs);

    var stdDev = Math.sqrt(avgSquareDiff);
    return stdDev;
}

function clone(data: any, method?: string | null | undefined) {
    var cloneMethod = method || "parse-stringify",
        cloned;
    if (cloneMethod === "parse-stringify") {
        cloned = JSON.parse(JSON.stringify(data));
    }
    return cloned;
}

export = Collection;
