import Arrays = require("ts-mortar/utils/Arrays");
import Objects = require("ts-mortar/utils/Objects");
import ChangeTrackers = require("../change-trackers/ChangeTrackers");
import ModelKeysImpl = require("../key-constraints/ModelKeysImpl");
import PrimaryKeyMaintainer = require("../key-constraints/PrimaryKeyMaintainer");
import NonNullKeyMaintainer = require("../key-constraints/NonNullKeyMaintainer");
import PermissionedDataPersister = require("../persisters/PermissionedDataPersister");
import Collection = require("./Collection");
import EventEmitter = require("./TsEventEmitter");


interface InMemDbCloneFunc {
    (obj: any, cloneDeep?: boolean | ((obj: any) => any)): any;
}


/** An InMemDb implementation that wraps a InMemDbProvider database
 */
class InMemDbImpl implements InMemDb, MemDbCollectionSet {
    public name: string;
    public events: TsEventEmitter<{ init: any[]; flushChanges: any[]; close: any[]; changes: any[]; warning: any[] }>;
    readonly settings: ReadWritePermission & StorageFormatSettings;
    collections: MemDbCollection<any>[];
    databaseVersion: number;
    environment: string;
    changeTracker: DbChanges | null = null;
    private metaDataCollectionName: string;
    private nonNullKeyMaintainer: NonNullKeyMaintainer | null = null;
    private primaryKeyMaintainer: PrimaryKeyMaintainer | null = null;
    private reloadMetaData: boolean;
    private modelDefinitions: ModelDefinitions;
    private modelKeys: ModelKeys;
    private getCreateCollectionSettings: ((collectionName: string) => MemDbCollectionOptions<any> | null) | null; // ({ unique?: string[]; exact?: string[] } & LokiCollectionOptions & { [name: string]: any; })
    private cloneFunc: InMemDbCloneFunc;
    private getModelObjKeys: <T>(obj: T, collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>) => (keyof T & string)[];


    /** Create an in-memory database instance using the following parameters.
     * @param dbName the name of the in-memory database
     * @param settings permissions for the underlying data persister, this doesn't enable/disable the read/writing to this in-memory database,
     * this only affects the underlying data persister created from the 'dataPersisterFactory'
     * @param storeSettings settings used for the data persister
     * @param cloneType the type of clone operation to use when copying elements
     * @param metaDataCollectionName the name of the collection to store collection meta-data in
     * @param reloadMetaData whether to recalculate meta-data from collections and data models or re-use existing saved meta-data
     * @param modelDefinitions a set of model definitions defining all the models in this data base
     * @param databaseInitializer a function which creates the underlying InMemDbProvider used by this InMemDb
     * @param dataPersisterFactory a factory for creating a data persister
     * @param createCollectionSettingsFunc a function which returns collection initialization settings for a given collection name
     * @param modelKeysFunc option function to retrieve the property names for a given data model object
     */
    constructor(dbName: string,
        options: { env?: ("BROWSER" | "CORDOVA" | "NODEJS") } & ReadWritePermission & StorageFormatSettings,
        cloneType: "for-in-if" | "keys-for-if" | "keys-excluding-for" | "clone-delete",
        metaDataCollectionName: string,
        reloadMetaData: boolean,
        modelDefinitions: ModelDefinitions,
        createCollectionSettingsFunc: ((collectionName: string) => MemDbCollectionOptions<any> | null) | null,
        modelKeysFunc: <T>(obj: T, collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>) => (keyof T & string)[]
    ) {
        this.name = dbName;
        this.collections = [];
        this.databaseVersion = 1.2; // persist version of code which created the database
        this.settings = options;
        this.modelDefinitions = modelDefinitions;
        this.modelKeys = new ModelKeysImpl(modelDefinitions);
        this.metaDataCollectionName = metaDataCollectionName;
        this.reloadMetaData = reloadMetaData;
        this.cloneFunc = <InMemDbCloneFunc>(cloneType === "for-in-if" ? InMemDbImpl.cloneForInIf :
            (cloneType === "keys-for-if" ? InMemDbImpl.cloneKeysForIf :
                (cloneType === "keys-excluding-for" ? InMemDbImpl.cloneKeysExcludingFor :
                    (cloneType === "clone-delete" ? InMemDbImpl.cloneCloneDelete : null))));
        if (this.cloneFunc == null) {
            throw new Error("cloneType '" + cloneType + "' is not a recognized clone type");
        }
        this.getCreateCollectionSettings = createCollectionSettingsFunc;
        this.getModelObjKeys = modelKeysFunc;

        this.events = new EventEmitter({
            "init": [],
            "flushChanges": [],
            "close": [],
            "changes": [],
            "warning": []
        });

        function getEnvironment() {
            if (typeof window === "undefined") {
                return "NODEJS";
            }

            if (typeof global !== "undefined" && (<any>global)["window"]) {
                return "NODEJS"; //node-webkit
            }

            if (typeof document !== "undefined") {
                if (document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1) {
                    return "CORDOVA";
                }
                return "BROWSER";
            }
            return "CORDOVA";
        }

        // if no options.env provided, detect environment (browser vs node vs cordova).
        // two properties used for similar thing (options.env and options.persistenceMethod)
        //   might want to review whether we can consolidate.
        if (options && options.env != null) {
            this.environment = options.env;
        } else {
            this.environment = getEnvironment();
        }

        this.events.on("init", () => { if (this.changeTracker != null) this.changeTracker.clearChanges(); });
    }


    public getName() {
        return this.name;
    }


    // ======== Data Collection manipulation ========

    public listCollections(): MemDbCollection<any>[] {
        return this.collections;
    }


    public getCollection(collectionName: string, autoCreate: true): MemDbCollection<any>;
    public getCollection(collectionName: string, autoCreate?: boolean): MemDbCollection<any> | null;
    public getCollection(collectionName: string, autoCreate: boolean = true): MemDbCollection<any> | null {
        var coll: MemDbCollection<any> | null = null;
        for (var i = 0, len = this.collections.length; i < len; i++) {
            if (this.collections[i].name === collectionName) {
                coll = this.collections[i];
            }
        }

        if (coll == null) {
            if (!autoCreate) {
                // no such collection
                this.events.emit("warning", "collection " + collectionName + " not found");
                return null;
            }
            else {
                var settings = this.getCreateCollectionSettings != null ? this.getCreateCollectionSettings(collectionName) : null;
                coll = this.addCollection(collectionName, settings);
                coll.dirty = true;
            }
        }
        return coll;
    }


    public addCollection(name: string, options?: MemDbCollectionOptions<any> | null): MemDbCollection<any> {
        var collection = new Collection(name, options);
        this.collections.push(collection);

        return collection;
    }


    public loadCollection(collection: MemDbCollection<any>) {
        if (!collection.name) {
            throw new Error("Collection must be have a name property to be loaded");
        }
        this.collections.push(collection);
    }


    public clearCollection(collection: string | MemDbCollection<any>, dstMetaData?: Changes.CollectionChangeTracker): void {
        var coll = typeof collection === "string" ? this.getCollection(collection) : collection;

        if (coll != null) {
            if (dstMetaData) {
                dstMetaData.addChangeItemsRemoved(coll.data.length);
            }

            coll.dirty = true;
            coll.clear();
        }
    }


    public removeCollection(collection: string | MemDbCollection<any>, dstMetaData?: Changes.CollectionChangeTracker): void {
        var coll = typeof collection === "string" ? this.getCollection(collection, false) : collection;

        if (coll != null) {
            if (dstMetaData) {
                dstMetaData.addChangeItemsRemoved(coll.data.length);
            }
            for (var i = 0, len = this.collections.length; i < len; i++) {
                if (this.collections[i].name === coll.name) {
                    this.collections.splice(i, 1);
                    break;
                }
            }
        }
    }


    // ==== Meta-data Getters/Setters ====

    public getModelDefinitions(): ModelDefinitions {
        return this.modelDefinitions;
    }


    public getModelKeys(): ModelKeys {
        return this.modelKeys;
    }


    public createDataPersister(dataPersisterFactory: DataPersister.Factory, permissioned = true): DataPersister {
        var dataPersister = dataPersisterFactory(this, () => this.listCollections(), (collName: string) => this.cloneFunc, (collName: string) => null);
        if (permissioned) {
            var permissionedAdapter = new PermissionedDataPersister(dataPersister, this.settings, this.settings);
            return permissionedAdapter;
        }
        else {
            return dataPersister;
        }
    }


    // ======== Database CRUD Operations ========

    public data<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, query: any, queryProps?: string[]): T[] {
        return <T[]>this._findNResults(collection, dataModel, 0, Infinity, query, queryProps, false, false);
    }


    public find<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, query: any, queryProps?: string[]): ResultSetLike<T> {
        if (query == null || collection.data.length === 0) {
            return collection.chain();
        }

        return this._findMultiProp(collection, query, queryProps);
    }


    public first<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, query: any, queryProps?: string[], throwIfNone?: boolean, throwIfMultiple?: boolean): T {
        return <T>this._findNResults(collection, dataModel, 1, 1, query, queryProps, throwIfNone, throwIfMultiple);
    }


    public add<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, doc: T, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): T {
        return <T><any>this._addHandlePrimaryAndGeneratedKeys(collection, dataModel, ModelKeysImpl.Constraint.NON_NULL,
            noModify ? ModelKeysImpl.Generated.PRESERVE_EXISTING : ModelKeysImpl.Generated.AUTO_GENERATE,
            [doc], dstMetaData);
    }


    public addAll<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, docs: T[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): T[] {
        return <T[]>this._addHandlePrimaryAndGeneratedKeys(collection, dataModel, ModelKeysImpl.Constraint.NON_NULL,
            noModify ? ModelKeysImpl.Generated.PRESERVE_EXISTING : ModelKeysImpl.Generated.AUTO_GENERATE,
            docs, dstMetaData);
    }


    public addOrUpdateWhere<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, dataModelFuncs: DtoFuncs<T>, query: any, obj: Partial<T>, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): void {
        query = this.modelKeys.validateQuery(collection.name, query, obj);

        var results = this.find(collection, dataModel, query);

        var compoundDstMetaData: Changes.CollectionChangeTracker & Changes.CollectionChange | undefined = <never>null;
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
            var updateKeys = this.getModelObjKeys(<T>obj, collection, dataModel);
            var updateKeysLen = updateKeys.length;

            //update
            for (var i = 0, size = toUpdate.length; i < size; i++) {
                var doc = toUpdate[i];

                // assign obj props -> doc
                var idx = -1;
                while (++idx < updateKeysLen) {
                    var key = updateKeys[idx];
                    (<any>doc)[key] = obj[key];
                }

                this.update(collection, dataModel, doc);
            }
        }
        else {
            // assign query props -> obj
            // This ensures that search keys information is present before inserting
            var queryKeys = <(keyof T & string)[]>Object.keys(query);
            var idx = -1;
            var len = queryKeys.length;
            while (idx++ < len) {
                var key = queryKeys[idx];
                (<any>obj)[key] = query[key];
            }

            this.add(collection, dataModel, <T>obj, noModify, compoundDstMetaData);
        }
    }


    public addOrUpdateAll<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, dataModelFuncs: DtoFuncs<T>, keyName: keyof T, updatesArray: Partial<T>[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): void {
        var cloneFunc: (obj: T) => T = (dataModelFuncs && dataModelFuncs.copyFunc) || ((obj) => InMemDbImpl.cloneDeepWithoutMetaData(obj, undefined, this.cloneFunc));
        var existingData = this.find(collection, dataModel, null).data();
        // pluck keys from existing data
        var existingDataKeys: T[keyof T][] = [];
        for (var i = 0, size = existingData.length; i < size; i++) {
            var prop = existingData[i][keyName];
            existingDataKeys.push(prop);
        }

        var toAdd: T[] = [];
        var toUpdate: T[] = [];
        for (var j = 0, sz = updatesArray.length; j < sz; j++) {
            var update = updatesArray[j];
            var idx = existingDataKeys.indexOf((<T>update)[keyName]);
            if (idx === -1) {
                toAdd.push(cloneFunc((<T>update)));
            }
            else {
                toUpdate.push((<T>update));
            }
        }

        var compoundDstMetaData: Changes.CollectionChangeTracker & Changes.CollectionChange | undefined = <never>null;
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
            var query: any = {};
            query[keyName] = item[keyName];
            this.updateWhere(collection, dataModel, query, item);
        }
    }


    public update<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, doc: Partial<T>, dstMetaData?: Changes.CollectionChangeTracker): void {
        if (dstMetaData) {
            dstMetaData.addChangeItemsModified(doc);
        }

        collection.dirty = true;
        this.dataModified(collection, doc, null, dstMetaData);
        return collection.update(<T & MemDbObj>doc);
    }


    public updateWhere<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, query: any, obj: Partial<T>, dstMetaData?: Changes.CollectionChangeTracker): void {
        query = this.modelKeys.validateQuery(collection.name, query, obj);

        var resData = this._findMultiProp(collection, query).data();

        if (dstMetaData && resData.length > 0) {
            dstMetaData.addChangeItemsModified(resData.length);
        }

        // get obj props, except the MemDb specific ones
        var updateKeys = this.getModelObjKeys<T>(<T>obj, collection, dataModel);
        var updateKeysLen = updateKeys.length;

        for (var i = 0, size = resData.length; i < size; i++) {
            var doc = resData[i];

            // assign obj props -> doc
            var idx = -1;
            while (++idx < updateKeysLen) {
                var key = updateKeys[idx];
                doc[key] = <T[keyof T & string]>(<any>obj)[key];
            }

            this.update(collection, dataModel, doc);
        }
    }


    public remove<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, doc: T, dstMetaData?: Changes.CollectionChangeTracker): void {
        if (dstMetaData) {
            dstMetaData.addChangeItemsRemoved(doc);
        }

        collection.dirty = true;
        this.dataRemoved(collection, doc, null, dstMetaData);
        collection.remove(doc);
    }


    public removeWhere<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, query: any, dstMetaData?: Changes.CollectionChangeTracker): void {
        var docs = this.find(collection, dataModel, query).data();
        for (var i = docs.length - 1; i > -1; i--) {
            var doc = docs[i];
            this.remove(collection, dataModel, doc, dstMetaData);
        }
    }


    // ======== query and insert implementations ========

    _addHandlePrimaryAndGeneratedKeys<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, primaryConstraint: ModelKeysImpl.Constraint,
            generateOption: ModelKeysImpl.Generated, docs: T[], dstMetaData?: Changes.CollectionChangeTracker): T[] | null {
        // TODO primaryConstraint and generateOption validation
        if (!docs || docs.length === 0) {
            return null;
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

        collection.dirty = true;
        this.dataAdded(collection, docs, null, dstMetaData);
        return collection.insert(docs);
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


    /** Execute a query (including optimizations and additional flags for various use cases)
     * @param collection the collection to query
     * @param dataModel the collection's data model
     * @param min the minimum number of results expected
     * @param max the maximum number of results expected
     * @param query the query to run
     * @param queryProps optional sub-set of query properties from the query
     * @param queryPropLimit a limit on the number of query props to use
     * @param throwIfLess whether to throw an error if less than 'min' results are found by the query
     * @param throwIfMore whether to throw an error if more than 'max' results are found by the query
     */
    private _findNResults<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, min: number, max: number, query: any,
            queryProps: string[] | null | undefined, throwIfLess: boolean | null | undefined, throwIfMore: boolean | null | undefined): T | T[] | null {
        if (min > max) {
            throw new Error("illegal argument exception min=" + min + ", max=" + max + ", min must be less than max");
        }

        // null query or empty collection
        if (collection.data.length === 0) {
            return max === 1 ? null : [];
        }
        if (query == null) {
            return max === 1 ? collection.data[0] : collection.data;
        }

        // single item lookups are probably based on a strong key, perhaps a primary key, so get the query properties to see if it's a single primary key query
        if (max === 1 && queryProps == null) {
            queryProps = Object.keys(query);
        }

        // search by primary key
        if (queryProps != null && queryProps.length === 1 && collection.constraints.unique[<keyof T>queryProps[0]] != null) {
            var itm = collection.by(<keyof T>queryProps[0], query[queryProps[0]]);

            if (throwIfLess && itm == null) {
                throw new Error("could not find " + (max == 1 ? (min == 1 ? "unique " : "atleast one ") : min + "-" + max) + " matching value from '" + collection.name + "' for query: " + JSON.stringify(query) + ", found 0 results");
            }
            return itm;
        }
        // search by regular multi-property query
        else {
            var res = this._findMultiProp(collection, query, queryProps, max === 1).data();

            if ((throwIfLess && res.length < min) || (throwIfMore && res.length > max)) {
                throw new Error("could not find " + (max == 1 ? (min == 1 ? "unique " : "atleast one ") : min + "-" + max) + " matching value from '" + collection.name + "' for query: " + JSON.stringify(query) + ", found " + res.length + " results");
            }
            return max === 1 ? res[0] : res;
        }
    }


    private _findMultiProp<S>(coll: MemDbCollection<S>, query: any, queryProps?: string[] | null, firstOnly?: boolean): ResultSetLike<S> {
        var results: MemDbResultset<S> = coll.chain();
        if (!queryProps) {
            for (var prop in query) {
                var localQuery: StringMap<any> = {};
                localQuery[prop] = query[prop];
                results = <any>results.find(localQuery, firstOnly);
            }
        }
        else {
            for (var i = 0, size = queryProps.length; i < size; i++) {
                var propI = queryProps[i];
                var localQuery: StringMap<any> = {};
                localQuery[propI] = query[propI];
                results = <any>results.find(localQuery, firstOnly);
            }
        }
        return results;
    }


    // ======== event loggers ========
    private dataAdded(coll: MemDbCollection<any>, newDocs: any | any[], query: any, dstMetaData: Changes.CollectionChangeTracker | null | undefined) {
        // events not yet implemented
    }


    private dataModified(coll: MemDbCollection<any>, changeDoc: any | any[], query: any, dstMetaData: Changes.CollectionChangeTracker | null | undefined) {
        // events not yet implemented
    }


    private dataRemoved(coll: MemDbCollection<any>, removedDoc: any | any[], query: any, dstMetaData: Changes.CollectionChangeTracker | null | undefined) {
        // events not yet implemented
    }


    // ======== Utility functions ========
    public cloneWithoutMetaData(obj: any, cloneDeep?: boolean | ((obj: any) => any)): any {
        return this.cloneFunc(obj, cloneDeep);
    }


    static cloneForInIf(obj: any, cloneDeep?: boolean | ((obj: any) => any)): any {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? Objects.clone : cloneDeep != null ? <(obj: any) => any>cloneDeep : Objects.clone);

        var copy: any = {};
        for (var key in obj) {
            if (key !== "$loki" && key !== "meta") {
                copy[key] = cloneFunc(obj[key]);
            }
        }
        return copy;
    }


    static cloneKeysForIf(obj: any, cloneDeep?: boolean | ((obj: any) => any)): any {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? Objects.clone : cloneDeep != null ? <(obj: any) => any>cloneDeep : Objects.clone);

        var copy: any = {};
        var keys = <string[]>Object.keys(obj);
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

        var copy: any = {};
        var keys = <string[]>Object.keys(obj);
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

}


/**-------------------------+
| Changes API               |
+--------------------------*/
/** The Changes API enables the tracking the changes occurred in the collections since the beginning of the session,
 * so it's possible to create a differential dataset for synchronization purposes (possibly to a remote db)
 */
class DbChanges implements MemDbChanges {
    getCollections: () => MemDbCollection<any>[]


    constructor(getCollections: () => MemDbCollection<any>[]) {
        this.getCollections = getCollections;
    }


    /** takes all the changes stored in each
     * collection and creates a single array for the entire database. If an array of names
     * of collections is passed then only the included collections will be tracked.
     *
     * @param {array} optional array of collection names. No arg means all collections are processed.
     * @returns {array} array of changes
     * @see private method createChange() in Collection
     */
    public generateChangesNotification(collectionNames: string[] | null | undefined) {
        var changes: any[] = [];

        this.getCollections().forEach(function (coll) {
            if (collectionNames == null || collectionNames.indexOf(coll.name) !== -1) {
                changes = changes.concat(coll.getChanges());
            }
        });
        return changes;
    }


    /** stringify changes for network transmission
     * @returns {string} string representation of the changes
     */
    public serializeChanges(collectionNames: string[] | null | undefined) {
        return JSON.stringify(this.generateChangesNotification(collectionNames));
    }


    /** clears all the changes in all collections.
     */
    public clearChanges() {
        this.getCollections().forEach(function (coll) {
            if (coll.flushChanges) {
                coll.flushChanges();
            }
        });
    }

}

export = InMemDbImpl;
