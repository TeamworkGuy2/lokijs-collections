﻿import Q = require("q");
import Arrays = require("../../ts-mortar/utils/Arrays");
import Objects = require("../../ts-mortar/utils/Objects");
import ChangeTrackers = require("../change-trackers/ChangeTrackers");
import ModelKeysImpl = require("../key-constraints/ModelKeysImpl");
import PrimaryKeyMaintainer = require("../key-constraints/PrimaryKeyMaintainer");
import NonNullKeyMaintainer = require("../key-constraints/NonNullKeyMaintainer");
import PermissionedDataPersister = require("./PermissionedDataPersister");


/** A ResultSetLike implementation for an empty collection
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


/** An InMemDb implementation that wraps a InMemDbProvider database
 */
class InMemDbImpl implements InMemDb {
    private primaryKeyMaintainer: PrimaryKeyMaintainer;
    private nonNullKeyMaintainer: NonNullKeyMaintainer;
    private metaDataCollectionName: string;
    private reloadMetaData: boolean;
    private modelDefinitions: ModelDefinitions;
    private modelKeys: ModelKeys;
    private db: InMemDbProvider<any>;
    private dbName: string;
    private dbInitializer: (dbName: string) => InMemDbProvider<any>;
    private dataPersisterFactory: DataPersister.Factory;
    private dataPersister: DataPersister;
    private syncSettings: ReadWritePermission;
    private storeSettings: StorageFormatSettings;
    private getCreateCollectionSettings: (collectionName: string) => any;
    private cloneFunc: InMemDbCloneFunc;
    private getModelObjKeys: <T>(obj: T, collection: LokiCollection<T>, dataModel: DataCollectionModel<T>) => string[];


    /**
     * @param dbName the name of the in-memory database
     * @param settings permissions for the underlying data persister, this doesn't enable/disable the read/writing to this in-memory database,
     * this only affects the underlying data persister created from teh 'dataPersisterFactory'
     * @param storeSettings settings used for the data persister
     * @param cloneType the type of clone operation to use when copying elements
     * @param metaDataCollectionName the name of the collection to store collection meta-data in
     * @param reloadMetaData whether to recalculate meta-data from collections and data models or re-use existing saved meta-data
     * @param modelDefinitions a set of model definitions defining all the models in this data base
     * @param dataPersisterFactory a factory for creating a data persister
     * @param modelKeysFunc option function to retrieve the property names for a given data model object
     */
    constructor(dbName: string, settings: ReadWritePermission, storeSettings: StorageFormatSettings, cloneType: "for-in-if" | "keys-for-if" | "keys-excluding-for" | "clone-delete",
            metaDataCollectionName: string, reloadMetaData: boolean,
            modelDefinitions: ModelDefinitions, databaseInitializer: (dbName: string) => InMemDbProvider<any>, dataPersisterFactory: (dbInst: InMemDb) => DataPersister,
            createCollectionSettingsFunc: <O>(collectionName: string) => O,
            modelKeysFunc: <T>(obj: T, collection: LokiCollection<T>, dataModel: DataCollectionModel<T>) => string[]) {
        this.dbName = dbName;
        this.dbInitializer = databaseInitializer;
        this.syncSettings = settings;
        this.storeSettings = storeSettings;
        this.modelDefinitions = modelDefinitions;
        this.modelKeys = new ModelKeysImpl(modelDefinitions);
        this.metaDataCollectionName = metaDataCollectionName;
        this.reloadMetaData = reloadMetaData;
        this.cloneFunc = cloneType === "for-in-if" ? InMemDbImpl.cloneForInIf :
            (cloneType === "keys-for-if" ? InMemDbImpl.cloneKeysForIf :
                (cloneType === "keys-excluding-for" ? InMemDbImpl.cloneKeysExcludingFor :
                    (cloneType === "clone-delete" ? InMemDbImpl.cloneCloneDelete : null)));
        if (this.cloneFunc == null) {
            throw new Error("cloneType '" + cloneType + "' is not a recognized clone type");
        }
        this.getCreateCollectionSettings = createCollectionSettingsFunc;
        this.getModelObjKeys = modelKeysFunc;

        this.dataPersisterFactory = dataPersisterFactory;
        this.dataPersister = InMemDbImpl.createDefaultDataPersister(this, dataPersisterFactory);
    }


    // ======== private methods ========

    private getPrimaryKeyMaintainer() {
        if (this.primaryKeyMaintainer == null) {
            this.primaryKeyMaintainer = new PrimaryKeyMaintainer(this.metaDataCollectionName, this.reloadMetaData, this, this.modelDefinitions, this.modelKeys);
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


    public initializeDb() {
        this.db = this.dbInitializer(this.dbName);
    }


    public resetDataStore(): Q.Promise<void> {
        var dfd = Q.defer<void>();
        this.db = null;
        this.dataPersister = InMemDbImpl.createDefaultDataPersister(this, this.dataPersisterFactory);
        dfd.resolve(null);
        return dfd.promise;
    }


    public setDataPersister(dataPersisterFactory: DataPersister.Factory): void {
        this.dataPersisterFactory = dataPersisterFactory;
        this.dataPersister = dataPersisterFactory(this, () => this.getCollections(), (collName: string) => this.cloneFunc, (collName: string) => null);
    }


    public getDataPersister(): DataPersister {
        return this.dataPersister;
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


    /** Query a result set against multiple criteria (AND logic)
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


    /** Query a collection, similar to find(), except that exactly one result is expected
     * @return a single object matching the query specified
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
        var updateKeys = this.getModelObjKeys(obj, collection, dataModel);
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


    public addOrUpdateWhere<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, dataModelFuncs: DtoFuncs<T>, query: any, obj: T, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): void {
        query = this.modelKeys.validateQuery(collection.name, query, obj);

        var results = this._findMultiProp(this.find(collection, dataModel), query);

        var compoundDstMetaData: Changes.CollectionChangeTracker & Changes.CollectionChange = null;
        if (dstMetaData) {
            compoundDstMetaData = new ChangeTrackers.CompoundCollectionChange();
            dstMetaData.addChange(compoundDstMetaData);
        }

        var toUpdate = results.data();
        if (toUpdate.length > 0) {
            if (compoundDstMetaData) {
                var cloneFunc: (obj: T) => T = (dataModelFuncs && dataModelFuncs.copyFunc) || ((obj) => InMemDbImpl.cloneDeepWithoutMetaData(obj, undefined, this.cloneFunc));
                compoundDstMetaData.addChangeItemsModified(toUpdate.map(cloneFunc));
            }

            // get obj props, except the implementation specific ones
            var updateKeys = this.getModelObjKeys(obj, collection, dataModel);
            var updateKeysLen = updateKeys.length;

            //update
            for (var i = 0, size = toUpdate.length; i < size; i++) {
                var doc = toUpdate[i];

                // assign obj props -> doc
                var idx = -1;
                while (++idx < updateKeysLen) {
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
        var cloneFunc: (obj: T) => T = (dataModelFuncs && dataModelFuncs.copyFunc) || ((obj) => InMemDbImpl.cloneDeepWithoutMetaData(obj, undefined, this.cloneFunc));
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
            compoundDstMetaData = new ChangeTrackers.CompoundCollectionChange();
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
        return this.db.listCollections();
    }


    public getCollection(collectionName: string, autoCreate: boolean = true): LokiCollection<any> {
        var coll = this.db.getCollection(collectionName);
        if (!coll) {
            if (!autoCreate) {
                return;
            }
            else {
                var settings = this.getCreateCollectionSettings(collectionName);
                coll = this.db.addCollection(collectionName, settings);
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


    // ======== private static methods ========

    private static createDefaultDataPersister(dbDataInst: InMemDbImpl, dataPersisterFactory: DataPersister.Factory): DataPersister {
        dbDataInst.setDataPersister((dbInst, getDataCollections, getSaveItemTransformFunc, getRestoreItemTransformFunc) => {
            var dataPersister = dataPersisterFactory(dbInst, getDataCollections, getSaveItemTransformFunc, getRestoreItemTransformFunc);
            var persistAdapter = new PermissionedDataPersister(dataPersister, dbDataInst.syncSettings, dbDataInst.storeSettings);
            return persistAdapter;
        });
        return dbDataInst.getDataPersister();
    }

}

export = InMemDbImpl;