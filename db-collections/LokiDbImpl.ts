/// <reference path="../definitions/lib/Q.d.ts" />
/// <reference path="../definitions/lib/lokijs.d.ts" />
import _ = require("lodash");
import Q = require("q");
import Loki = require("lokijs");
import Arrays = require("../lib/ts-mortar/utils/Arrays");
import ChangeTrackersImpl = require("../change-trackers/ChangeTrackersImpl");
import ModelKeysImpl = require("../key-constraints/ModelKeysImpl");
import PrimaryKeyMaintainer = require("../key-constraints/PrimaryKeyMaintainer");
import NonNullKeyMaintainer = require("../key-constraints/NonNullKeyMaintainer");
import PermissionedDataPersisterAdapter = require("./PermissionedDataPersisterAdapter");


function stripMetaData(obj: any, doCloneDeep?: boolean): any {
    var returnValue = _.clone(obj, doCloneDeep);

    delete returnValue.$loki;
    delete returnValue.meta;

    return returnValue;
}

function stripMetaDataCloneDeep(obj: any): any {
    var returnValue = _.cloneDeep(obj);

    delete returnValue.$loki;
    delete returnValue.meta;

    return returnValue;
}


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


/** An implementation of InMemDb that wraps a LokiJS database
 */
class InMemDbImpl implements InMemDb {
    private primaryKeyMaintainer: PrimaryKeyMaintainer;
    private nonNullKeyMaintainer: NonNullKeyMaintainer;
    private metaDataStorageCollectionName: string;
    private modelDefinitions: ModelDefinitions;
    private modelKeys: ModelKeys;
    private db: Loki;
    private dbName: string;
    private dataPersisterFactory: (dbInst: InMemDb) => DataPersister.Adapter;
    private saveRestore: DataPersister.Adapter;
    private syncSettings: ReadWritePermission;
    private storeSettings: StorageFormatSettings;


    constructor(dbName: string, settings: ReadWritePermission, storeSettings: StorageFormatSettings, metaDataStorageCollectionName: string,
            modelDefinitions: ModelDefinitions, dataPersisterFactory: (dbInst: InMemDb) => DataPersister.Adapter) {
        this.dbName = dbName;
        this.syncSettings = settings;
        this.storeSettings = storeSettings;
        this.modelDefinitions = modelDefinitions;
        this.modelKeys = new ModelKeysImpl(modelDefinitions);
        this.dataPersisterFactory = dataPersisterFactory;
        this.metaDataStorageCollectionName = metaDataStorageCollectionName;

        this.getCollections = this.getCollections.bind(this);
        this.saveRestore = InMemDbImpl.createDefaultDataPersister(this, dataPersisterFactory);
    }


    // ==== private methods ====

    private _createNewDb(dbName: string, options: LokiConfigureOptions) {
        return new Loki(dbName, options);
    }


    private _setNewDb(dataStore: Loki) {
        this.db = dataStore;
    }


    private static createDefaultDataPersister(dbDataInst: InMemDbImpl, dataPersisterFactory: (dbInst: InMemDb) => DataPersister.Adapter): DataPersister.Adapter {
        var dataPersister = dataPersisterFactory(dbDataInst);
        var persistAdapter = new PermissionedDataPersisterAdapter(dataPersister, dbDataInst.syncSettings, dbDataInst.storeSettings);
        dbDataInst.setDataPersister(persistAdapter);
        return persistAdapter;
    }

    private getPrimaryKeyMaintainer() {
        if (this.primaryKeyMaintainer == null) {
            this.primaryKeyMaintainer = new PrimaryKeyMaintainer(this.metaDataStorageCollectionName, this, this.modelKeys);
        }
        return this.primaryKeyMaintainer;
    }


    private getNonNullKeyMaintainer() {
        if (this.nonNullKeyMaintainer == null) {
            this.nonNullKeyMaintainer = new NonNullKeyMaintainer(this.modelKeys);
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


    public resetDataStore(): Q.Promise<void> {
        var dfd = Q.defer<void>();
        this.db = null;
        this.saveRestore = InMemDbImpl.createDefaultDataPersister(this, this.dataPersisterFactory);
        dfd.resolve(null);
        return dfd.promise;
    }


    public setDataPersister(dataPersister: DataPersister.Adapter): Q.Promise<void> {
        var dfd = Q.defer<void>();
        this.db = null;
        this.saveRestore = dataPersister;
        // link the data persister to this objects data collections and data store instances
        dataPersister.setDataStoreInterface(
            () => this.db,
            (dataStore: Loki) => this._setNewDb(dataStore),
            (options) => this._createNewDb(this.dbName, options)
        );
        dataPersister.setDataSources(this.getCollections);
        dataPersister.setDataConverters(stripMetaData, null);

        dfd.resolve(null);
        return dfd.promise;
    }


    public getDataPersister(): DataPersister.Adapter {
        return this.saveRestore;
    }


    // ==== Database CRUD Operations ====

    public add<T>(collection: LokiCollection<T>, doc: T, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): T[] {
        return this._addHandlePrimaryAndGeneratedKeys(collection, ModelKeysImpl.Constraint.NON_NULL,
            noModify ? ModelKeysImpl.Generated.PRESERVE_EXISTING : ModelKeysImpl.Generated.AUTO_GENERATE,
            [doc], dstMetaData);
    }


    public addAll<T>(collection: LokiCollection<T>, docs: T[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): T[] {
        return this._addHandlePrimaryAndGeneratedKeys(collection, ModelKeysImpl.Constraint.NON_NULL,
            noModify ? ModelKeysImpl.Generated.PRESERVE_EXISTING : ModelKeysImpl.Generated.AUTO_GENERATE,
            docs, dstMetaData);
    }


    _addHandlePrimaryAndGeneratedKeys<T>(collection: LokiCollection<T>, primaryConstraint: ModelKeysImpl.Constraint,
            generateOption: ModelKeysImpl.Generated, docs: T[], dstMetaData?: Changes.CollectionChangeTracker): T[] {
        // TODO primaryConstraint and generateOption validation
        if (!docs || docs.length === 0) {
            return;
        }

        // generate auto-generated keys if requested before checking unique IDs since the auto-generated keys may be unique IDs
        this.getPrimaryKeyMaintainer().manageKeys(collection.name, docs, generateOption === ModelKeysImpl.Generated.AUTO_GENERATE);
        //Ensure a legacy uniqueId field is present
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


    public update(collection: LokiCollection<any>, doc, dstMetaData?: Changes.CollectionChangeTracker): void {
        if (dstMetaData) {
            dstMetaData.addChangeItemsModified(doc);
        }

        collection.isDirty = true;
        this.dataModified(collection, doc, null, dstMetaData);
        return collection.update(doc);
    }


    public find<T>(collection: LokiCollection<T>, query?: any, queryProps?: string[]): ResultSetLike<T> {
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


    public findSinglePropQuery<T>(collection: LokiCollection<T>, query?: any, queryProps?: string[]): T[] {
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


    public remove(collection: LokiCollection<any>, doc, dstMetaData?: Changes.CollectionChangeTracker): void {
        if (!collection) {
            return;
        }
        if (dstMetaData) {
            dstMetaData.addChangeItemsRemoved(doc);
        }

        collection.isDirty = true;
        this.dataRemoved(collection, doc, null, dstMetaData);
        return collection.remove(doc);
    }


    // Utility methods =========================

    public getCollections(): LokiCollection<any>[] {
        return this.db.collections;
    }


    public getCollection(collectionName: string, autoCreate?: boolean): LokiCollection<any> {
        autoCreate = true;
        collectionName = collectionName.toLowerCase();
        var coll = this.db.getCollection(collectionName);
        if (!coll) {
            if (!autoCreate) {
                return;
            }
            else {
                coll = this.db.addCollection(collectionName, { asyncListeners: false }); // async listeners cause performance issues (2015-1)
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


    /** Query a collection, similar to {@link #find()}, except that exactly one result is expected
     * @return {Object} a single object matching the query specified
     * @throws Error if the query results in more than one or no results
     */
    public findOne(collection: LokiCollection<any>, query) {
        return this._findNResults(collection, 1, 1, query);
    }


    _findOneOrNull(collection: LokiCollection<any>, query) {
        return this._findNResults(collection, 0, 1, query);
    }


    _findNResults(collection: LokiCollection<any>, min: number, max: number, query): any | any[] {
        if (min > max) {
            throw new Error("illegal argument exception min=" + min + ", max=" + max + ", min must be less than max");
        }

        var res = this.find(collection, query).data();
        if (res.length < min || res.length > max) {
            throw new Error("could not find " + (max == 1 ? (min == 1 ? "unique " : "atleast one ") : min + "-" + max) + "matching value from '" + collection.name + "' for query: " + JSON.stringify(query) + ", found " + res.length + " results");
        }
        return max === 1 ? res[0] : res;
    }


    /** Query with multiple criteria
     */
    _findMultiProp<S>(resSet: ResultSetLike<S>, query: any, queryProps?: string[]): ResultSetLike<S> {
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


    public updateWhere(collection: LokiCollection<any>, query, obj, dstMetaData?: Changes.CollectionChangeTracker): void {

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

            this.update(collection, doc);
        }
    }


    public addOrUpdateWhere(collection: LokiCollection<any>, query, obj, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): void {
        //remove loki information so not to overwrite it.
        query = this.modelKeys.validateQuery(collection.name, query, obj);

        var results = this._findMultiProp(this.find(collection), query);

        var compoundDstMetaData: Changes.CollectionChangeTracker & Changes.CollectionChange = null;
        if (dstMetaData) {
            compoundDstMetaData = new ChangeTrackersImpl.CompoundCollectionChange();
            dstMetaData.addChange(compoundDstMetaData);
        }

        var toUpdate = results.data();
        if (toUpdate.length > 0) {
            if (compoundDstMetaData) {
                compoundDstMetaData.addChangeItemsModified(toUpdate.map(stripMetaDataCloneDeep));
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

                this.update(collection, doc);
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

            this.add(collection, <any>obj, noModify, compoundDstMetaData);
        }
    }


    public removeWhere(collection: LokiCollection<any>, query, dstMetaData?: Changes.CollectionChangeTracker): void {
        var docs = this.find(collection, query).data();
        for (var i = 0, size = docs.length; i < size; i++) {
            var doc = docs[i];
            this.remove(collection, doc, dstMetaData);
        }
    }


    public addOrUpdateAll(collection: LokiCollection<any>, keyName: string, updatesArray: any[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): void {
        var existingData = this.find(collection).data();
        // pluck keys from existing data
        var existingDataKeys = [];
        for (var ii = 0, sizeI = existingData.length; ii < sizeI; ii++) {
            var prop = existingData[i][keyName];
            existingDataKeys.push(prop);
        }

        var toAdd = [];
        var toUpdate = [];
        for (var i = 0, size = updatesArray.length; i < size; i++) {
            var update = updatesArray[i];
            var idx = existingDataKeys.indexOf(update[keyName]);
            if (idx === -1) {
                toAdd.push(stripMetaDataCloneDeep(update));
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

        this.addAll(collection, toAdd, noModify, compoundDstMetaData);

        if (compoundDstMetaData && toUpdate.length > 0) {
            compoundDstMetaData.addChangeItemsModified(toUpdate.map(stripMetaDataCloneDeep));
        }

        for (var i = 0, size = toUpdate.length; i < size; i++) {
            var item = toUpdate[i];
            var query = {};
            query[keyName] = item[keyName];
            this.updateWhere(collection, query, item);
        }
    }


    // Array-like
    public mapReduce(collection: LokiCollection<any>, map: (value, index: number, array: any[]) => any,
            reduce: (previousValue, currentValue, currentIndex: number, array: any[]) => any) {
        return collection.mapReduce(map, reduce);
    }


    // ==== event loggers ====
    private dataAdded(coll: LokiCollection<any>, newDoc, query, dstMetaData: Changes.CollectionChangeTracker) {
        // events not yet implemented
    }


    private dataModified(coll: LokiCollection<any>, changeDoc, query, dstMetaData: Changes.CollectionChangeTracker) {
        // events not yet implemented
    }


    private dataRemoved(coll: LokiCollection<any>, removedDoc, query, dstMetaData: Changes.CollectionChangeTracker) {
        // events not yet implemented
    }


    // Utility functions =======================
    public stripMetaData(obj: any): any {
        return stripMetaData(obj);
    }


    public static stripMetaData(obj: any): any {
        return stripMetaData(obj);
    }

}

export = InMemDbImpl;
