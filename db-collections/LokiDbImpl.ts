/// <reference path="../../definitions/lib/Q.d.ts" />
/// <reference path="../../definitions/lib/lokijs.d.ts" />
import Q = require("q");
import Loki = require("lokijs");
import Arrays = require("../../ts-mortar/utils/Arrays");
import Objects = require("../../ts-mortar/utils/Objects");
import ChangeTrackersImpl = require("../change-trackers/ChangeTrackersImpl");
import ModelKeysImpl = require("../key-constraints/ModelKeysImpl");
import PrimaryKeyMaintainer = require("../key-constraints/PrimaryKeyMaintainer");
import NonNullKeyMaintainer = require("../key-constraints/NonNullKeyMaintainer");
import PermissionedDataPersisterAdapter = require("./PermissionedDataPersisterAdapter");


/** A {@link ResultSetLike} implementation for an empty collection
 * @author TeamworkGuy2
 */
class ResultsetMock<E> implements ResultSetLike<E> {

    data() {
        return [];
    }

    find() {
        return this;
    }

    offset() {
        return this;
    }

    limit() {
        return this;
    }

    simplesort() {
        return this;
    }

    where() {
        return this;
    }

}


interface InMemDbCloneFunc {
    (obj: any, cloneDeep?: boolean | ((obj: any) => any)): any;
}


/** An implementation of InMemDb that wraps a LokiJS database
 */
class LokiDbImpl implements InMemDb {
    private primaryKeyMaintainer: PrimaryKeyMaintainer;
    private nonNullKeyMaintainer: NonNullKeyMaintainer;
    private metaDataStorageCollectionName: string;
    private modelDefinitions: ModelDefinitions;
    private modelKeys: ModelKeys;
    private db: Loki;
    private dbName: string;
    private dataPersisterFactory: DataPersister.AdapterFactory;
    private dataPersisterInst: DataPersister.Adapter;
    private syncSettings: ReadWritePermission;
    private storeSettings: StorageFormatSettings;
    private cloneFunc: InMemDbCloneFunc;


    /** 
     * @param dbName the name of the in-memory lokijs database
     * @param settings permissions for the underlying data persister, this doesn't enable/disable the read/writing to this in-memory database,
     * this only affects the underlying data persister created from teh 'dataPersisterFactory'
     * @param storeSettings settings used for the data persister
     * @param cloneType the type of clone operation to use when copying elements
     * @param metaDataStorageCollectionName the name of the collection to store collection meta-data in
     * @param modelDefinitions a set of model definitions defining all the models in this data base
     * @param dataPersisterFactory a factory for creating a data persister
     */
    constructor(dbName: string, settings: ReadWritePermission, storeSettings: StorageFormatSettings, cloneType: "for-in-if" | "keys-for-if" | "keys-excluding-for" | "clone-delete", metaDataStorageCollectionName: string,
            modelDefinitions: ModelDefinitions, dataPersisterFactory: (dbInst: InMemDb) => DataPersister.Adapter) {
        this.dbName = dbName;
        this.syncSettings = settings;
        this.storeSettings = storeSettings;
        this.modelDefinitions = modelDefinitions;
        this.modelKeys = new ModelKeysImpl(modelDefinitions);
        this.metaDataStorageCollectionName = metaDataStorageCollectionName;
        this.cloneFunc = cloneType === "for-in-if" ? LokiDbImpl.cloneForInIf : (cloneType === "keys-for-if" ? LokiDbImpl.cloneKeysForIf : (cloneType === "keys-excluding-for" ? LokiDbImpl.cloneKeysExcludingFor : (cloneType === "clone-delete" ? LokiDbImpl.cloneCloneDelete : null)));
        if (this.cloneFunc == null) {
            throw new Error("cloneType '" + cloneType + "' is not a recognized clone type");
        }

        this.dataPersisterFactory = dataPersisterFactory;
        this.dataPersisterInst = LokiDbImpl.createDefaultDataPersister(this, dataPersisterFactory);
    }


    // ======== static methods ========

    private static _createNewDb(dbName: string, options: LokiConfigureOptions) {
        return new Loki(dbName, options);
    }

    private static createDefaultDataPersister(dbDataInst: LokiDbImpl, dataPersisterFactory: DataPersister.AdapterFactory): DataPersister.Adapter {
        dbDataInst.setDataPersister((dbInst, getDataCollections, getSaveItemTransformFunc, getRestoreItemTransformFunc) => {
            var dataPersister = dataPersisterFactory(dbInst, getDataCollections, getSaveItemTransformFunc, getRestoreItemTransformFunc);
            var persistAdapter = new PermissionedDataPersisterAdapter(dataPersister, dbDataInst.syncSettings, dbDataInst.storeSettings);
            return persistAdapter;
        });
        return dbDataInst.getDataPersister();
    }


    // ======== private methods ========

    private _setNewDb(dataStore: Loki) {
        this.db = dataStore;
    }

    private getPrimaryKeyMaintainer() {
        if (this.primaryKeyMaintainer == null) {
            this.primaryKeyMaintainer = new PrimaryKeyMaintainer(this.metaDataStorageCollectionName, this, this.modelDefinitions, this.modelKeys);
        }
        return this.primaryKeyMaintainer;
    }

    private getNonNullKeyMaintainer() {
        if (this.nonNullKeyMaintainer == null) {
            this.nonNullKeyMaintainer = new NonNullKeyMaintainer(this.modelDefinitions);
        }
        return this.nonNullKeyMaintainer;
    }


    // ==== Meta-data Getters/Setters ====

    public getModelDefinitions(): ModelDefinitions {
        return this.modelDefinitions;
    }


    public getModelKeys(): ModelKeys {
        return this.modelKeys;
    }


    public initializeDb(options: LokiConfigureOptions) {
        this._setNewDb(LokiDbImpl._createNewDb(this.dbName, options));
    }


    public resetDataStore(): Q.Promise<void> {
        var dfd = Q.defer<void>();
        this.db = null;
        this.dataPersisterInst = LokiDbImpl.createDefaultDataPersister(this, this.dataPersisterFactory);
        dfd.resolve(null);
        return dfd.promise;
    }


    public setDataPersister(dataPersisterFactory: DataPersister.AdapterFactory): void {
        this.dataPersisterFactory = dataPersisterFactory;
        this.dataPersisterInst = dataPersisterFactory(this, () => this.getCollections(), (collName: string) => this.cloneFunc, (collName: string) => null);
    }


    public getDataPersister(): DataPersister.Adapter {
        return this.dataPersisterInst;
    }


    _addHandlePrimaryAndGeneratedKeys<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, primaryConstraint: ModelKeysImpl.Constraint,
            generateOption: ModelKeysImpl.Generated, docs: T[], dstMetaData?: Changes.CollectionChangeTracker): T[] {
        // TODO primaryConstraint and generateOption validation
        if (!docs || docs.length === 0) {
            return;
        }

        // Generate auto-generated keys if requested before checking unique IDs since the auto-generated keys may be unique IDs
        this.getPrimaryKeyMaintainer().manageKeys(collection.name, docs, generateOption === ModelKeysImpl.Generated.AUTO_GENERATE);
        // Ensure a legacy uniqueId field is present
        if (primaryConstraint === ModelKeysImpl.Constraint.NON_NULL) {
            this.getNonNullKeyMaintainer().manageKeys(collection.name, docs, true);
        }
        else if (primaryConstraint === ModelKeysImpl.Constraint.UNIQUE) {
            throw new Error("ModelKeysImpl.Constraint.UNIQUE is not yet supported");
        }

        if (dstMetaData) {
            dstMetaData.addChangeItemsAdded(docs);
        }

        collection.isDirty = true;
        this.dataAdded(collection, docs, null, dstMetaData);
        return collection.insert(docs);
    }


    private _findOneOrNull<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, query) {
        return this._findNResults(collection, dataModel, 0, 1, query);
    }


    private _findNResults<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, min: number, max: number, query): any | any[] {
        if (min > max) {
            throw new Error("illegal argument exception min=" + min + ", max=" + max + ", min must be less than max");
        }

        var res = this.find(collection, dataModel, query).data();
        if (res.length < min || res.length > max) {
            throw new Error("could not find " + (max == 1 ? (min == 1 ? "unique " : "atleast one ") : min + "-" + max) + "matching value from '" + collection.name + "' for query: " + JSON.stringify(query) + ", found " + res.length + " results");
        }
        return max === 1 ? res[0] : res;
    }


    /** Query with multiple criteria
     */
    private _findMultiProp<S>(resSet: ResultSetLike<S>, query: any, queryProps?: string[]): ResultSetLike<S> {
        var results = resSet;
        if (!queryProps) {
            for (var prop in query) {
                var localQuery = {};
                localQuery[prop] = query[prop];
                results = results.find(localQuery);
            }
        }
        else {
            for (var i = 0, size = queryProps.length; i < size; i++) {
                var propI = queryProps[i];
                var localQuery = {};
                localQuery[propI] = query[propI];
                results = results.find(localQuery);
            }
        }

        return results;
    }


    // ======== Database CRUD Operations ========

    public add<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, doc: T, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): T[] {
        return this._addHandlePrimaryAndGeneratedKeys(collection, dataModel, ModelKeysImpl.Constraint.NON_NULL,
            noModify ? ModelKeysImpl.Generated.PRESERVE_EXISTING : ModelKeysImpl.Generated.AUTO_GENERATE,
            [doc], dstMetaData);
    }


    public addAll<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, docs: T[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): T[] {
        return this._addHandlePrimaryAndGeneratedKeys(collection, dataModel, ModelKeysImpl.Constraint.NON_NULL,
            noModify ? ModelKeysImpl.Generated.PRESERVE_EXISTING : ModelKeysImpl.Generated.AUTO_GENERATE,
            docs, dstMetaData);
    }


    public update<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, doc, dstMetaData?: Changes.CollectionChangeTracker): void {
        if (dstMetaData) {
            dstMetaData.addChangeItemsModified(doc);
        }

        collection.isDirty = true;
        this.dataModified(collection, doc, null, dstMetaData);
        return collection.update(doc);
    }


    public find<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, query?: any, queryProps?: string[]): ResultSetLike<T> {
        // Check for empty collection
        // TODO remove, users should never request non-existent collections..?
        if (!collection) {
            return new ResultsetMock();
        }
        else if (collection.data.length === 0) {
            return collection.chain();
        }

        var results = this._findMultiProp(collection.chain(), query, queryProps);
        return results;
    }


    public findSinglePropQuery<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, query?: any, queryProps?: string[]): T[] {
        if (!collection) {
            throw new Error("null collection with query: " + query);
        }
        else if (collection.data.length === 0) {
            return [];
        }

        //Get all results
        var queryProps = queryProps ? queryProps : (query ? Object.keys(query) : null);
        if (queryProps && queryProps.length > 1) {
            throw new Error("query '" + query + "' has more than 1 prop, findSinglePropQueryData() only accepts 1 prop");
        }
        var results = collection.find(query);
        return results;
    }


    public remove<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, doc, dstMetaData?: Changes.CollectionChangeTracker): void {
        if (!collection) {
            return;
        }
        if (dstMetaData) {
            dstMetaData.addChangeItemsRemoved(doc);
        }

        collection.isDirty = true;
        this.dataRemoved(collection, doc, null, dstMetaData);
        collection.remove(doc);
    }


    /** Query a collection, similar to {@link #find()}, except that exactly one result is expected
     * @return {Object} a single object matching the query specified
     * @throws Error if the query results in more than one or no results
     */
    public findOne<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, query) {
        return this._findNResults(collection, dataModel, 1, 1, query);
    }


    public updateWhere<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, query, obj, dstMetaData?: Changes.CollectionChangeTracker): void {

        query = this.modelKeys.validateQuery(collection.name, query, obj);

        var results = this._findMultiProp(collection.chain(), query);
        var resData = results.data();

        if (dstMetaData && resData.length > 0) {
            dstMetaData.addChangeItemsModified(resData.length);
        }

        // get obj props, except the lokijs specific ones
        var updateKeys = Object.keys(obj);
        Arrays.fastRemove(updateKeys, "$loki");
        Arrays.fastRemove(updateKeys, "meta");
        var updateKeysLen = updateKeys.length;

        for (var i = 0, size = resData.length; i < size; i++) {
            var doc = resData[i];

            // assign obj props -> doc
            var idx = -1;
            while (idx++ < updateKeysLen) {
                var key = updateKeys[idx];
                doc[key] = obj[key];
            }

            this.update(collection, dataModel, doc);
        }
    }


    public addOrUpdateWhere<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, dataModelFuncs: DtoFuncs<T>, query, obj: T, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): void {
        var cloneFunc: (obj: T) => T = (dataModelFuncs && dataModelFuncs.copyFunc) || ((obj) => LokiDbImpl.cloneDeepWithoutMetaData(obj, undefined, this.cloneFunc));

        query = this.modelKeys.validateQuery(collection.name, query, obj);

        var results = this._findMultiProp(this.find(collection, dataModel), query);

        var compoundDstMetaData: Changes.CollectionChangeTracker & Changes.CollectionChange = null;
        if (dstMetaData) {
            compoundDstMetaData = new ChangeTrackersImpl.CompoundCollectionChange();
            dstMetaData.addChange(compoundDstMetaData);
        }

        var toUpdate = results.data();
        if (toUpdate.length > 0) {
            if (compoundDstMetaData) {
                compoundDstMetaData.addChangeItemsModified(toUpdate.map(cloneFunc));
            }

            // get obj props, except the lokijs specific ones
            var updateKeys = Object.keys(obj);
            Arrays.fastRemove(updateKeys, "$loki");
            Arrays.fastRemove(updateKeys, "meta");
            var updateKeysLen = updateKeys.length;

            //update
            for (var i = 0, size = toUpdate.length; i < size; i++) {
                var doc = toUpdate[i];

                // assign obj props -> doc
                var idx = -1;
                while (idx++ < updateKeysLen) {
                    var key = updateKeys[idx];
                    doc[key] = obj[key];
                }

                this.update(collection, dataModel, doc);
            }
        }
        else {
            // assign query props -> obj
            // This ensures that search keys information is present before inserting
            var queryKeys = Object.keys(query);
            var idx = -1;
            var len = queryKeys.length;
            while (idx++ < len) {
                var key = queryKeys[idx];
                obj[key] = query[key];
            }

            this.add(collection, dataModel, obj, noModify, compoundDstMetaData);
        }
    }


    public removeWhere<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, query, dstMetaData?: Changes.CollectionChangeTracker): void {
        var docs = this.find(collection, dataModel, query).data();
        for (var i = docs.length - 1; i > -1; i--) {
            var doc = docs[i];
            this.remove(collection, dataModel, doc, dstMetaData);
        }
    }


    public addOrUpdateAll<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, dataModelFuncs: DtoFuncs<T>, keyName: string, updatesArray: T[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): void {
        var cloneFunc: (obj: T) => T = (dataModelFuncs && dataModelFuncs.copyFunc) || ((obj) => LokiDbImpl.cloneDeepWithoutMetaData(obj, undefined, this.cloneFunc));
        var existingData = this.find(collection, dataModel).data();
        // pluck keys from existing data
        var existingDataKeys = [];
        for (var ii = 0, sizeI = existingData.length; ii < sizeI; ii++) {
            var prop = existingData[ii][keyName];
            existingDataKeys.push(prop);
        }

        var toAdd: T[] = [];
        var toUpdate: T[] = [];
        for (var i = 0, size = updatesArray.length; i < size; i++) {
            var update = updatesArray[i];
            var idx = existingDataKeys.indexOf(update[keyName]);
            if (idx === -1) {
                toAdd.push(cloneFunc(update));
            }
            else {
                toUpdate.push(update);
            }
        }

        var compoundDstMetaData: Changes.CollectionChangeTracker & Changes.CollectionChange = null;
        if (dstMetaData) {
            compoundDstMetaData = new ChangeTrackersImpl.CompoundCollectionChange();
            dstMetaData.addChange(compoundDstMetaData);
        }

        this.addAll(collection, dataModel, toAdd, noModify, compoundDstMetaData);

        if (compoundDstMetaData && toUpdate.length > 0) {
            compoundDstMetaData.addChangeItemsModified(toUpdate.map(cloneFunc));
        }

        for (var i = 0, size = toUpdate.length; i < size; i++) {
            var item = toUpdate[i];
            var query = {};
            query[keyName] = item[keyName];
            this.updateWhere(collection, dataModel, query, item);
        }
    }


    // Array-like
    public mapReduce<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, map: (value: T, index: number, array: any[]) => any,
            reduce: (previousValue, currentValue, currentIndex: number, array: any[]) => any) {
        return collection.mapReduce(map, reduce);
    }


    // ======== Data Collection manipulation ========

    public getCollections(): LokiCollection<any>[] {
        return this.db.collections;
    }


    public getCollection(collectionName: string, autoCreate?: boolean, settings: LokiCollectionOptions = {}): LokiCollection<any> {
        autoCreate = true;
        collectionName = collectionName;
        var coll = this.db.getCollection(collectionName);
        if (!coll) {
            if (!autoCreate) {
                return;
            }
            else {
                settings = Objects.assign({ asyncListeners: false }, settings);
                coll = this.db.addCollection(collectionName, settings); // async listeners cause performance issues (2015-1)
                coll.isDirty = true;
            }
        }
        return coll;
    }


    public clearCollection(collection: string | LokiCollection<any>, dstMetaData?: Changes.CollectionChangeTracker): void {
        var coll: LokiCollection<any> = typeof collection === "string" ? this.getCollection(collection) : collection;

        if (coll) {
            if (dstMetaData) {
                dstMetaData.addChangeItemsRemoved(coll.data.length);
            }

            coll.isDirty = true;
            coll.clear();
        }
    }


    public removeCollection(collection: string | LokiCollection<any>, dstMetaData?: Changes.CollectionChangeTracker): void {
        var coll = typeof collection === "string" ? this.getCollection(collection) : collection;

        if (dstMetaData) {
            var collRes = this.db.getCollection<any>(coll.name);
            if (collRes) {
                dstMetaData.addChangeItemsRemoved(collRes.data.length);
            }
        }

        if (coll) {
            this.db.removeCollection(coll.name);
        }
    }


    // ======== event loggers ========
    private dataAdded(coll: LokiCollection<any>, newDoc, query, dstMetaData: Changes.CollectionChangeTracker) {
        // events not yet implemented
    }


    private dataModified(coll: LokiCollection<any>, changeDoc, query, dstMetaData: Changes.CollectionChangeTracker) {
        // events not yet implemented
    }


    private dataRemoved(coll: LokiCollection<any>, removedDoc, query, dstMetaData: Changes.CollectionChangeTracker) {
        // events not yet implemented
    }


    // ======== Utility functions ========
    public cloneWithoutMetaData(obj: any, cloneDeep?: boolean | ((obj: any) => any)): any {
        return this.cloneFunc(obj, cloneDeep);
    }


    static cloneForInIf(obj: any, cloneDeep?: boolean | ((obj: any) => any)): any {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? Objects.clone : cloneDeep != null ? <(obj: any) => any>cloneDeep : Objects.clone);

        var copy = {};
        for (var key in obj) {
            if (key !== "$loki" && key !== "meta") {
                copy[key] = cloneFunc(obj[key]);
            }
        }
        return copy;
    }


    static cloneKeysForIf(obj: any, cloneDeep?: boolean | ((obj: any) => any)): any {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? Objects.clone : cloneDeep != null ? <(obj: any) => any>cloneDeep : Objects.clone);

        var copy = {};
        var keys = Object.keys(obj);
        for (var i = 0, size = keys.length; i < size; i++) {
            var key = keys[i];
            if (key !== "$loki" && key !== "meta") {
                copy[key] = cloneFunc(obj[key]);
            }
        }
        return copy;
    }


    static cloneKeysExcludingFor(obj: any, cloneDeep?: boolean | ((obj: any) => any)): any {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? Objects.clone : cloneDeep != null ? <(obj: any) => any>cloneDeep : Objects.clone);

        var copy = {};
        var keys = Object.keys(obj);
        Arrays.fastRemove(keys, "$loki");
        Arrays.fastRemove(keys, "meta");
        for (var i = 0, size = keys.length; i < size; i++) {
            var key = keys[i];
            copy[key] = cloneFunc(obj[key]);
        }
        return copy;
    }


    static cloneCloneDelete(obj: any, cloneDeep?: boolean | ((obj: any) => any)): any {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? Objects.clone : cloneDeep != null ? <(obj: any) => any>cloneDeep : Objects.clone);

        var copy = cloneFunc(obj);

        delete copy.$loki;
        delete copy.meta;

        return copy;
    }


    static cloneDeepWithoutMetaData(obj: any, cloneDeep: (obj: any) => any = Objects.cloneDeep, type: InMemDbCloneFunc): any {
        return type(obj, cloneDeep);
    }


    public benchmarkClone<T>(objs: T[], loops: number, cloneDeep?: boolean | ((obj: any) => any), averagedLoops = 10): { items: number; loops: number; clone_delete: number; for_in_if: number; keys_for_if: number; keys_excluding_for: number; _res: any; } {
        return LokiDbImpl.benchmarkClone(objs, loops, cloneDeep, averagedLoops);
    }


    static benchmarkClone<T>(objs: T[], loops: number, cloneDeep?: boolean | ((obj: any) => any), averagedLoops = 10): { items: number; loops: number; clone_delete: number; for_in_if: number; keys_for_if: number; keys_excluding_for: number; _res: any; } {
        var _res = [];
        var warmupLoops = Math.max(Math.round(loops / 2), 2);
        var items = objs.length;
        // warmup
        for (var i = 0; i < warmupLoops; i++) {
            var resI = 0;
            for (var ii = 0; ii < items; ii++) {
                resI += LokiDbImpl.cloneForInIf(objs[ii], cloneDeep) !== null ? 1 : 0;
            }
            for (var ii = 0; ii < items; ii++) {
                resI += LokiDbImpl.cloneKeysForIf(objs[ii], cloneDeep) !== null ? 1 : 0;
            }
            for (var ii = 0; ii < items; ii++) {
                resI += LokiDbImpl.cloneKeysExcludingFor(objs[ii], cloneDeep) !== null ? 1 : 0;
            }
            for (var ii = 0; ii < items; ii++) {
                resI += LokiDbImpl.cloneCloneDelete(objs[ii], cloneDeep) !== null ? 1 : 0;
            }
            _res.push(resI);
        }

        var resI = 0;

        // test with timers
        function for_in_if_func() {
            var start = window.performance.now();
            for (var i = 0; i < loops; i++) {
                for (var ii = 0; ii < items; ii++) {
                    resI += LokiDbImpl.cloneForInIf(objs[ii], cloneDeep) !== null ? 1 : 0;
                }
            }
            return window.performance.now() - start;
        }

        function keys_for_if_func() {
            var start = window.performance.now();
            for (var i = 0; i < loops; i++) {
                for (var ii = 0; ii < items; ii++) {
                    resI += LokiDbImpl.cloneKeysForIf(objs[ii], cloneDeep) !== null ? 1 : 0;
                }
            }
            return window.performance.now() - start;
        }

        function keys_excluding_for_func() {
            var start = window.performance.now();
            for (var i = 0; i < loops; i++) {
                for (var ii = 0; ii < items; ii++) {
                    resI += LokiDbImpl.cloneKeysExcludingFor(objs[ii], cloneDeep) !== null ? 1 : 0;
                }
            }
            return window.performance.now() - start;
        }

        function clone_delete_func() {
            var start = window.performance.now();
            for (var i = 0; i < loops; i++) {
                for (var ii = 0; ii < items; ii++) {
                    resI += LokiDbImpl.cloneCloneDelete(objs[ii], cloneDeep) !== null ? 1 : 0;
                }
            }
            return window.performance.now() - start;
        }

        var tasksAndTimes = [
            { totalTime: 0, func: clone_delete_func },
            { totalTime: 0, func: for_in_if_func },
            { totalTime: 0, func: keys_excluding_for_func },
            { totalTime: 0, func: keys_for_if_func },
        ];

        for (var k = 0; k < averagedLoops; k++) {
            tasksAndTimes[0].totalTime += tasksAndTimes[0].func();
            tasksAndTimes[1].totalTime += tasksAndTimes[1].func();
            tasksAndTimes[2].totalTime += tasksAndTimes[2].func();
            tasksAndTimes[3].totalTime += tasksAndTimes[3].func();

            tasksAndTimes[1].totalTime += tasksAndTimes[1].func();
            tasksAndTimes[0].totalTime += tasksAndTimes[0].func();
            tasksAndTimes[3].totalTime += tasksAndTimes[3].func();
            tasksAndTimes[2].totalTime += tasksAndTimes[2].func();

            tasksAndTimes[3].totalTime += tasksAndTimes[3].func();
            tasksAndTimes[0].totalTime += tasksAndTimes[0].func();
            tasksAndTimes[2].totalTime += tasksAndTimes[2].func();
            tasksAndTimes[1].totalTime += tasksAndTimes[1].func();
        }

        _res.push(resI);

        return {
            items,
            loops,
            _res,
            clone_delete: tasksAndTimes[0].totalTime / (averagedLoops * 3),
            for_in_if: tasksAndTimes[1].totalTime / (averagedLoops * 3),
            keys_excluding_for: tasksAndTimes[2].totalTime / (averagedLoops * 3),
            keys_for_if: tasksAndTimes[3].totalTime / (averagedLoops * 3),
        }
    }

}

export = LokiDbImpl;
