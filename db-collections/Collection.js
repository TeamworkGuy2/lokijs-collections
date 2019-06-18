"use strict";
var EventEmitter = require("./TsEventEmitter");
var Resultset = require("./Resultset");
/** Collection class that handles documents of same type
 */
var Collection = /** @class */ (function () {
    /**
     * @param name - collection name
     * @param options - configuration object
     */
    function Collection(name, options) {
        /* -------- STAGING API -------- */
        /**
         * stages: a map of uniquely identified 'stages', which hold copies of objects to be
         * manipulated without affecting the data in the original collection
         */
        this.stages = {};
        /** a collection of objects recording the changes applied through a commmitStage
         */
        this.commitLog = [];
        // the name of the collection
        this.name = name;
        // the data held by the collection
        this.data = [];
        this.idIndex = []; // index of id
        this.binaryIndices = {}; // user defined indexes
        this.constraints = {
            unique: {},
            exact: {}
        };
        // the object type of the collection
        this.objType = name;
        // in autosave scenarios we will use collection level dirty flags to determine whether save is needed.
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
            "close": [],
            "flushbuffer": [],
            "error": [],
            "delete": [],
            "warning": []
        });
        // changes are tracked by collection and aggregated by the db
        this.changes = [];
        // initialize the id index
        this.ensureId();
        var indices = [];
        // initialize optional user-supplied indices array ['age', 'lname', 'zip']
        //if (typeof indices !== 'undefined') {
        if (options && options.indices) {
            if (Object.prototype.toString.call(options.indices) === "[object Array]") {
                indices = options.indices;
            }
            else {
                throw new TypeError("Indices must be a string or an array of strings");
            }
        }
        for (var idx = 0; idx < indices.length; idx++) {
            this.ensureIndex(indices[idx]);
        }
        /** This method creates a clone of the current status of an object and associates operation and collection name,
         * so the parent db can aggregate and generate a changes object for the entire db
         */
        function createChange(name, op, obj) {
            self.changes.push({
                name: name,
                operation: op,
                obj: JSON.parse(JSON.stringify(obj))
            });
        }
        this.getChanges = function () {
            return self.changes;
        };
        // clear all the changes
        this.flushChanges = function flushChanges() {
            self.changes = [];
        };
        /** If the changes API is disabled make sure only metadata is added without re-evaluating everytime if the changesApi is enabled
         */
        function insertMeta(obj) {
            if (obj == null) {
                return;
            }
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
        function updateMeta(obj) {
            if (obj == null) {
                return;
            }
            obj.meta.updated = (new Date()).getTime();
            obj.meta.revision += 1;
        }
        function insertMetaWithChange(obj) {
            insertMeta(obj);
            createChange(self.name, 'I', obj);
        }
        function updateMetaWithChange(obj) {
            updateMeta(obj);
            createChange(self.name, 'U', obj);
        }
        /* assign correct handler based on ChangesAPI flag */
        var insertHandler, updateHandler;
        function setHandlers() {
            insertHandler = self.disableChangesApi ? insertMeta : insertMetaWithChange;
            updateHandler = self.disableChangesApi ? updateMeta : updateMetaWithChange;
        }
        setHandlers();
        this.setChangesApi = function setChangesApi(enabled) {
            self.disableChangesApi = !enabled;
            setHandlers();
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
                createChange(self.name, 'R', obj);
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
    Collection.prototype.ensureIndex = function (prop, force) {
        // optional parameter to force rebuild whether flagged as dirty or not
        if (force === undefined) {
            force = false;
        }
        if (prop == null) {
            throw new Error("Attempting to set index without an associated property");
        }
        if (this.binaryIndices.hasOwnProperty(prop) && !force) {
            if (!this.binaryIndices[prop].dirty)
                return;
        }
        this.binaryIndices[prop] = {
            "name": prop,
            "dirty": true,
            "values": []
        };
        var index = this.binaryIndices[prop], len = this.data.length, i = 0;
        // initialize index values
        for (i; i < len; i++) {
            index.values.push(i);
        }
        var coll = this;
        function comparer(a, b) {
            var prop1 = coll.data[a][prop];
            var prop2 = coll.data[b][prop];
            if (prop1 === prop2)
                return 0;
            //if (gtHelper(prop1, prop2)) return 1;
            //if (ltHelper(prop1, prop2)) return -1;
            if (prop2 == null)
                return 1;
            if (prop1 == null)
                return -1;
            return (prop1 > prop2 ? 1 : -1);
        }
        ;
        index.values.sort(comparer);
        index.dirty = false;
        this.dirty = true; // for autosave scenarios
    };
    Collection.prototype.ensureUniqueIndex = function (field) {
        var index = this.constraints.unique[field];
        if (!index) {
            this.constraints.unique[field] = new UniqueIndex(field);
        }
        var self = this;
        this.data.forEach(function (obj) {
            self.constraints.unique[field].set(obj);
        });
    };
    /** Ensure all binary indices
     */
    Collection.prototype.ensureAllIndexes = function (force) {
        var objKeys = Object.keys(this.binaryIndices);
        var i = objKeys.length;
        while (i--) {
            this.ensureIndex(objKeys[i], force);
        }
    };
    Collection.prototype.flagBinaryIndexesDirty = function (objKeys) {
        objKeys = objKeys || Object.keys(this.binaryIndices);
        var i = objKeys.length;
        while (i--) {
            this.binaryIndices[objKeys[i]].dirty = true;
        }
    };
    Collection.prototype.count = function () {
        return this.data.length;
    };
    /** Rebuild idIndex
     */
    Collection.prototype.ensureId = function () {
        var len = this.data.length, i = 0;
        this.idIndex = [];
        for (i; i < len; i++) {
            this.idIndex.push(this.data[i].$loki);
        }
    };
    /** Rebuild idIndex async with callback - useful for background syncing with a remote server
     */
    Collection.prototype.ensureIdAsync = function (callback) {
        var self = this;
        this.async(function () {
            self.ensureId();
        }, callback);
    };
    /** Each collection maintains a list of DynamicViews associated with it
     */
    Collection.prototype.addDynamicView = function (dv) {
        this.dynamicViews.push(dv);
        return dv;
    };
    Collection.prototype.removeDynamicView = function (name) {
        for (var idx = 0; idx < this.dynamicViews.length; idx++) {
            if (this.dynamicViews[idx].name === name) {
                var dvs = this.dynamicViews.splice(idx, 1);
                return dvs[0];
            }
        }
        return null;
    };
    Collection.prototype.getDynamicView = function (name) {
        for (var idx = 0; idx < this.dynamicViews.length; idx++) {
            if (this.dynamicViews[idx].name === name) {
                return this.dynamicViews[idx];
            }
        }
        return null;
    };
    /** find and update: pass a filtering function to select elements to be updated
     * and apply the updatefunc to those elements iteratively
     */
    Collection.prototype.findAndUpdate = function (filterFunc, updateFunc) {
        var results = this.where(filterFunc);
        try {
            for (var i = 0; i < results.length; i++) {
                var obj = updateFunc(results[i]);
                this.update(obj);
            }
        }
        catch (err) {
            this.rollback();
            this.events.emit("error", err);
            throw err;
        }
    };
    Collection.prototype.insert = function (doc) {
        if (!doc) {
            var error = new Error("Parameter 'doc' cannot be null");
            this.events.emit("error", error);
            throw error;
        }
        var self = this;
        // holder to the clone of the object inserted if collections is set to clone objects
        var docs = Array.isArray(doc) ? doc : [doc];
        var results = [];
        docs.forEach(function (d) {
            if (typeof d !== "object") {
                throw new TypeError("Document must be an object");
            }
            var obj = (self.cloneObjects ? JSON.parse(JSON.stringify(d)) : d);
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
    };
    Collection.prototype.clear = function () {
        this.data = [];
        this.idIndex = [];
        this.binaryIndices = {};
        /* custom fix repopulating collection */
        var self = this;
        Object.keys(this.constraints.unique).forEach(function (prop) {
            self.constraints.unique[prop].clear();
        });
        Object.keys(this.constraints.exact).forEach(function (prop) {
            self.constraints.exact[prop].clear();
        });
        this.cachedIndex = null;
        this.cachedData = null;
        this.maxId = 0;
        this.dynamicViews = [];
        this.dirty = true;
    };
    /** Update method
     */
    Collection.prototype.update = function (doc) {
        var binaryIdxs = Object.keys(this.binaryIndices);
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
            var arr = this.get(doc.$loki, true), self = this;
            if (!arr) {
                throw new Error("Trying to update a document not in collection.");
            }
            this.events.emit("pre-update", doc);
            var obj = arr[0];
            Object.keys(this.constraints.unique).forEach(function (key) {
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
            this.idIndex[position] = obj.$loki;
            this.commit();
            this.dirty = true; // for autosave scenarios
            this.events.emit("update", doc);
        }
        catch (err) {
            this.rollback();
            this.events.emit("error", err);
            throw err; // re-throw error so user does not think it succeeded
        }
    };
    /** Add object to collection
     */
    Collection.prototype.add = function (obj) {
        var dvlen = this.dynamicViews.length;
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
                this.maxId = (this.data[this.data.length - 1].$loki + 1);
            }
            obj.$loki = this.maxId;
            // add the object
            this.data.push(obj);
            var self = this;
            Object.keys(this.constraints.unique).forEach(function (key) {
                self.constraints.unique[key].set(obj);
            });
            // now that we can efficiently determine the data[] position of newly added document,
            // submit it for all registered DynamicViews to evaluate for inclusion/exclusion
            for (var i = 0; i < dvlen; i++) {
                this.dynamicViews[i].evaluateDocument(this.data.length - 1);
            }
            // add new obj id to idIndex
            this.idIndex.push(obj.$loki);
            this.commit();
            this.dirty = true; // for autosave scenarios
            return obj;
        }
        catch (err) {
            this.rollback();
            this.events.emit("error", err);
            throw err;
        }
    };
    Collection.prototype.removeWhere = function (query) {
        var list = (typeof query === "function" ? this.data.filter(query) : Resultset.from(this, query));
        var len = list.length;
        while (len--) {
            this.remove(list[len]);
        }
        for (var dv in this.dynamicViews) {
            this.dynamicViews[dv].rematerialize();
        }
    };
    Collection.prototype.removeDataOnly = function () {
        this.removeWhere(function (obj) {
            return true;
        });
    };
    /** delete wrapped
     */
    Collection.prototype.remove = function (doc) {
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
        if (!doc.hasOwnProperty("$loki")) {
            throw new Error("Object is not a document stored in the collection");
        }
        var binaryIdxs = Object.keys(this.binaryIndices);
        if (binaryIdxs.length > 0) {
            this.flagBinaryIndexesDirty();
        }
        try {
            var item = doc;
            this.startTransaction();
            var arr = this.get(item.$loki, true), 
            // obj = arr[0],
            position = arr[1];
            var self = this;
            Object.keys(this.constraints.unique).forEach(function (key) {
                self.constraints.unique[key].remove(item[key]);
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
            delete item.$loki;
            delete item.meta;
            return item;
        }
        catch (err) {
            this.rollback();
            this.events.emit("error", err);
            throw err;
        }
    };
    Collection.prototype.get = function (id, returnPos) {
        var retpos = returnPos || false, data = this.idIndex, max = data.length - 1, min = 0, mid = Math.floor(min + (max - min) / 2);
        if (isNaN(id)) {
            throw new TypeError("Parameter 'id' is not an integer: " + id);
        }
        while (data[min] < data[max]) {
            mid = Math.floor((min + max) / 2);
            if (data[mid] < id) {
                min = mid + 1;
            }
            else {
                max = mid;
            }
        }
        if (max === min && data[min] === id) {
            if (retpos) {
                return [this.data[min], min];
            }
            return this.data[min];
        }
        // TODO should never happen, throw error
        return null;
    };
    Collection.prototype.by = function (field, value) {
        if (!value) {
            var self = this;
            return function byProxy(value) {
                return self.by(field, value);
            };
        }
        return this.constraints.unique[field].get(value);
    };
    /** Chain method, used for beginning a series of chained find() and/or view() operations
     * on a collection.
     */
    Collection.prototype.chain = function () {
        // TODO <any> cast fix for TS 3.2 vs 3.5 when imported into another project
        return Resultset.from(this, null, null);
    };
    /** Find one object by index property, by property equal to value
     */
    Collection.prototype.findOne = function (query) {
        // Instantiate Resultset and exec find op passing firstOnly = true param
        var res = Resultset.from(this, query, null, true);
        if (Array.isArray(res) && res.length === 0) {
            return null;
        }
        else {
            return res;
        }
    };
    /** Find method, api is similar to mongodb except for now it only supports one search parameter.
     * for more complex queries use view() and storeView()
     */
    Collection.prototype.find = function (query) {
        if (query === undefined) {
            query = "getAll";
        }
        // find logic moved into Resultset class
        var resSet = Resultset.from(this, query, null);
        return resSet;
    };
    /** Find object by unindexed property equal to the specified value.
     * Simply iterates and returns the first element matching the query
     */
    Collection.prototype.findOneUnindexed = function (prop, value) {
        var ary = this.data;
        for (var i = 0, len = ary.length; i < len; i++) {
            if (ary[i][prop] === value) {
                return ary[i];
            }
        }
        return null;
    };
    /**
     * Transaction methods
     */
    /** start the transation */
    Collection.prototype.startTransaction = function () {
        if (this.transactional) {
            this.cachedData = clone(this.data, "parse-stringify");
            this.cachedIndex = this.idIndex;
            this.cachedBinaryIndex = this.binaryIndices;
            // propagate startTransaction to dynamic views
            for (var idx = 0; idx < this.dynamicViews.length; idx++) {
                this.dynamicViews[idx].startTransaction();
            }
        }
    };
    /** commit the transation */
    Collection.prototype.commit = function () {
        if (this.transactional) {
            this.cachedData = null;
            this.cachedIndex = null;
            // propagate commit to dynamic views
            for (var idx = 0; idx < this.dynamicViews.length; idx++) {
                this.dynamicViews[idx].commit();
            }
        }
    };
    /** roll back the transation */
    Collection.prototype.rollback = function () {
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
    };
    // async executor. This is only to enable callbacks at the end of the execution.
    Collection.prototype.async = function (func, callback) {
        setTimeout(function () {
            if (typeof func === "function") {
                func();
                callback();
            }
            else {
                throw new TypeError("Parameter 'func' is not a function");
            }
        }, 0);
    };
    Collection.prototype.where = function (func) {
        // find logic moved into Resultset class
        var resSet = Resultset.from(this, null, func);
        return resSet;
    };
    /** create a stage and/or retrieve it
     */
    Collection.prototype.getStage = function (name) {
        if (!this.stages[name]) {
            this.stages[name] = {};
        }
        return this.stages[name];
    };
    /** create a copy of an object and insert it into a stage
     */
    Collection.prototype.stage = function (stageName, obj) {
        var copy = JSON.parse(JSON.stringify(obj));
        this.getStage(stageName)[obj.$loki] = copy;
        return copy;
    };
    /** re-attach all objects to the original collection, so indexes and views can be rebuilt
     * then create a message to be inserted in the commitlog
     */
    Collection.prototype.commitStage = function (stageName, message) {
        var stage = this.getStage(stageName), timestamp = new Date().getTime();
        for (var prop in stage) {
            this.update(stage[prop]);
            this.commitLog.push({
                timestamp: timestamp,
                message: message,
                data: JSON.parse(JSON.stringify(stage[prop]))
            });
        }
        this.stages[stageName] = {};
    };
    Collection.prototype.extract = function (field) {
        var result = [];
        for (var i = 0, len = this.data.length; i < len; i++) {
            result.push(this.data[i][field]);
        }
        return result;
    };
    Collection.prototype.max = function (field) {
        return Math.max.apply(null, this.extract(field));
    };
    Collection.prototype.min = function (field) {
        return Math.min.apply(null, this.extract(field));
    };
    Collection.prototype.maxRecord = function (field) {
        var i = 0, len = this.data.length, result = {
            index: 0,
            value: undefined
        }, max;
        for (i; i < len; i++) {
            if (max !== undefined) {
                if (max < this.data[i][field]) {
                    max = this.data[i][field];
                    result.index = this.data[i].$loki;
                }
            }
            else {
                max = this.data[i][field];
                result.index = this.data[i].$loki;
            }
        }
        result.value = max;
        return result;
    };
    Collection.prototype.minRecord = function (field) {
        var i = 0, len = this.data.length, result = {
            index: 0,
            value: undefined
        }, min;
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
    };
    Collection.prototype.extractNumerical = function (field) {
        return this.extract(field).map(_parseFloat).filter(function (n) {
            return Number(n) && !isNaN(n);
        });
    };
    Collection.prototype.avg = function (field) {
        return average(this.extractNumerical(field));
    };
    Collection.prototype.stdDev = function (field) {
        return standardDeviation(this.extractNumerical(field));
    };
    Collection.prototype.mode = function (field) {
        var dict = {}, data = this.extract(field);
        data.forEach(function (obj) {
            if (dict[obj]) {
                dict[obj] += 1;
            }
            else {
                dict[obj] = 1;
            }
        });
        var max, mode;
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
    };
    Collection.prototype.median = function (field) {
        var values = this.extractNumerical(field);
        values.sort(sub);
        var half = Math.floor(values.length / 2);
        if (values.length % 2) {
            return values[half];
        }
        else {
            return (values[half - 1] + values[half]) / 2.0;
        }
    };
    return Collection;
}());
var UniqueIndex = /** @class */ (function () {
    function UniqueIndex(uniqueField) {
        this.keyMap = {};
        this.lokiMap = {};
        this.field = uniqueField;
        this.keyMap = {};
        this.lokiMap = {};
    }
    UniqueIndex.prototype.set = function (obj) {
        var field = this.field;
        if (this.keyMap[obj[field]]) {
            throw new Error("Duplicate key for property " + field + ": " + obj[field]);
        }
        else {
            this.keyMap[obj[field]] = obj;
            this.lokiMap[obj.$loki] = obj[field];
        }
    };
    UniqueIndex.prototype.get = function (key) {
        return this.keyMap[key] || null;
    };
    UniqueIndex.prototype.byId = function (id) {
        return this.keyMap[this.lokiMap[id]];
    };
    UniqueIndex.prototype.update = function (obj) {
        var field = this.field;
        if (this.lokiMap[obj.$loki] !== obj[field]) {
            var old = this.lokiMap[obj.$loki];
            this.set(obj);
            // make the old key fail bool test, while avoiding the use of delete (mem-leak prone)
            this.keyMap[old] = undefined;
        }
        else {
            this.keyMap[obj[field]] = obj;
        }
    };
    UniqueIndex.prototype.remove = function (key) {
        var obj = this.keyMap[key];
        if (obj != null) {
            this.keyMap[key] = undefined;
            this.lokiMap[obj.$loki] = undefined;
        }
        else {
            throw new Error("could not find index ID for key '" + key + "'");
        }
    };
    UniqueIndex.prototype.clear = function () {
        this.keyMap = {};
        this.lokiMap = {};
    };
    return UniqueIndex;
}());
var ExactIndex = /** @class */ (function () {
    function ExactIndex(exactField) {
        this.index = {};
        this.field = exactField;
    }
    // add the value you want returned to the key in the index 
    ExactIndex.prototype.set = function (key, val) {
        var ix = this.index[key];
        if (ix) {
            ix.push(val);
        }
        else {
            this.index[key] = [val];
        }
    };
    // remove the value from the index, if the value was the last one, remove the key
    ExactIndex.prototype.remove = function (key, val) {
        var ixSet = this.index[key];
        if (ixSet == null) {
            throw new Error("could not find index ID for key '" + key + "'");
        }
        for (var i in ixSet) {
            if (ixSet[i] == val) {
                ixSet.splice(i, 1);
            }
        }
        if (ixSet.length < 1) {
            this.index[key] = undefined;
        }
    };
    // get the values related to the key, could be more than one
    ExactIndex.prototype.get = function (key) {
        return this.index[key] || null;
    };
    // clear will zap the index
    ExactIndex.prototype.clear = function () {
        this.index = {};
    };
    return ExactIndex;
}());
/**
 * General utils, including statistical functions
 */
function _parseFloat(num) {
    return parseFloat(num);
}
function add(a, b) {
    return a + b;
}
function sub(a, b) {
    return a - b;
}
function median(values) {
    values.sort(sub);
    var half = Math.floor(values.length / 2);
    return (values.length % 2) ? values[half] : ((values[half - 1] + values[half]) / 2.0);
}
function average(array) {
    return array.reduce(add, 0) / array.length;
}
function standardDeviation(values) {
    var avg = average(values);
    var squareDiffs = values.map(function (value) {
        var diff = value - avg;
        return diff * diff;
    });
    var avgSquareDiff = average(squareDiffs);
    var stdDev = Math.sqrt(avgSquareDiff);
    return stdDev;
}
function clone(data, method) {
    var cloneMethod = method || "parse-stringify", cloned;
    if (cloneMethod === "parse-stringify") {
        cloned = JSON.parse(JSON.stringify(data));
    }
    return cloned;
}
module.exports = Collection;
