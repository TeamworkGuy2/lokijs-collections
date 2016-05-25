import Arrays = require("../../ts-mortar/utils/Arrays");

/** Builder for SyncSettings, SyncUpSettings, and SyncDownSettings instances.
 * Both SyncUpSettings and SyncDownSettings require a base SyncSettings instance to build on top of.
 * SyncUpSettings and SyncDownSettings can be combined, but only one is required.
 * So using this class normally looks like:
 *   new SyncSettingsBuilder()
 *     .addSettings(...)
 *     .addSyncUpSettings(...)
 * AND/OR
 *     .addSyncDownSettings(...)
 * THEN
 *     .build()
 *
 * @param <E> the base local data type
 * @param <F> the base local data type with optional parameters for creating query objects
 * @param <P> sync up parameters
 * @param <S> remote data type
 * @param <U> sync up result
 * @param <R> sync error
 *
 * @author TeamworkGuy2
 * @since 2016-3-7
 */
class SyncSettingsBuilder<E, F, P, S, U, R> implements SettingsBuilder<E, F> {
    // sync settings
    localCollection: DataCollection<E, F>;
    primaryKeys: string[];
    findFilterFunc: (item: S) => F;
    copyObjectFunc: (item: E) => E;
    convertUrlToSyncDownFunc: (url: string) => (params: any) => PsPromise<S[], R>;
    convertUrlToSyncUpFunc: (url: string) => (params: P, items: S[]) => PsPromise<U, R>;
    // sync down
    syncDownFunc: (params: P) => PsPromise<S[], R>;
    convertToLocalObjectFunc: (item: S) => E;
    // sync up
    syncUpFunc: (params: P, items: S[]) => PsPromise<U, R>;
    convertToSvcObjectFunc: (item: E) => S;


    constructor() {
    }


    public addSettings(localCollection: DataCollection<E, F>, primaryKeys: string | string[], findFilterFunc: (item: any) => any, copyObjectFunc: (item: E) => E) {
        this.localCollection = localCollection;
        this.primaryKeys = Arrays.asArray(primaryKeys);
        this.findFilterFunc = findFilterFunc;
        this.copyObjectFunc = copyObjectFunc;
        return this;
    }


    public addSettingsInst(settings: SyncSettings<E, F, S, R>) {
        this.localCollection = settings.localCollection;
        this.primaryKeys = settings.primaryKeys;
        this.findFilterFunc = settings.findFilterFunc;
        this.copyObjectFunc = settings.copyObjectFunc;
        return this;
    }


    public addSyncDownUrl(syncDownUrl: string, convertToLocalObjectFunc: (item: any) => E) {
        this.syncDownFunc = this.convertUrlToSyncDownFunc(syncDownUrl);
        this.convertToLocalObjectFunc = convertToLocalObjectFunc;
        return this;
    }


    public addSyncDownFunc(syncDownFunc: (params: P) => PsPromise<S[], R>, convertToLocalObjectFunc: (item: any) => E) {
        this.syncDownFunc = syncDownFunc;
        this.convertToLocalObjectFunc = convertToLocalObjectFunc;
        return this;
    }


    public addSyncDownSettings(syncDown: SyncDownSettings<E, F, P, S, R>) {
        this.syncDownFunc = syncDown.syncDownFunc;
        this.convertToLocalObjectFunc = syncDown.convertToLocalObjectFunc;
        return this;
    }


    public addSyncUpUrl(syncUpUrl: string, convertToSvcObjectFunc: (item: E) => any) {
        this.syncUpFunc = this.convertUrlToSyncUpFunc(syncUpUrl);
        this.convertToSvcObjectFunc = convertToSvcObjectFunc;
        return this;
    }


    public addSyncUpFunc(syncUpFunc: (params: P, items: S[]) => PsPromise<U, R>, convertToSvcObjectFunc: (item: E) => any) {
        this.syncUpFunc = syncUpFunc;
        this.convertToSvcObjectFunc = convertToSvcObjectFunc;
        return this;
    }


    public addSyncUpSettings(syncUp: SyncUpSettings<E, F, P, S, U, R>) {
        this.syncUpFunc = syncUp.syncUpFunc;
        this.convertToSvcObjectFunc = syncUp.convertToSvcObjectFunc;
        return this;
    }


    public build(): SyncSettingsWithUpDown<E, F, P, S, U, R> {
        return this;
    }


    public static copy<E1, F1, P1, S1, U1, R1>(src: SyncSettingsBuilder<E1, F1, P1, S1, U1, R1>, deepCopy: boolean = true) {
        if (deepCopy) {
            return new SyncSettingsBuilder().addSettingsInst(SyncSettingsBuilder.SyncSettingsImpl.copy(src))
                .addSyncDownSettings(SyncSettingsBuilder.SyncDownSettingsImpl.copy(src))
                .addSyncUpSettings(SyncSettingsBuilder.SyncUpSettingsImpl.copy(src));
        }
        return new SyncSettingsBuilder().addSettingsInst(src)
            .addSyncDownSettings(src)
            .addSyncUpSettings(src);
    }


    public static fromSettingsConvert<E, F, R>(localCollection: DataCollection<E, F>, primaryKeys: string | string[], findFilterFunc: (item: any) => any, copyObjectFunc: (item: E) => E,
        convertUrlToSyncDownFunc: (url: string) => (params: any) => PsPromise<any[], R>, convertUrlToSyncUpFunc: (url: string) => (params: any, items: any[]) => PsPromise<any, R>): SyncDownBuilderWithUrl<E, F> & SyncUpBuilderWithUrl<E, F> {
        var inst = new SyncSettingsBuilder<E, F, any, any, any, R>();
        inst.localCollection = localCollection;
        inst.primaryKeys = Arrays.asArray(primaryKeys);
        inst.findFilterFunc = findFilterFunc;
        inst.copyObjectFunc = copyObjectFunc;
        inst.convertUrlToSyncDownFunc = convertUrlToSyncDownFunc;
        inst.convertUrlToSyncUpFunc = convertUrlToSyncUpFunc;
        return inst;
    }


    public static fromSettings<E, F, R>(localCollection: DataCollection<E, F>, primaryKeys: string | string[], findFilterFunc: (item: any) => any, copyObjectFunc: (item: E) => E): SyncDownBuilder<E, F> & SyncUpBuilder<E, F> {
        var inst = new SyncSettingsBuilder<E, F, any, any, any, R>();
        inst.localCollection = localCollection;
        inst.primaryKeys = Arrays.asArray(primaryKeys);
        inst.findFilterFunc = findFilterFunc;
        inst.copyObjectFunc = copyObjectFunc;
        return inst;
    }


    public static fromSettingsObj<E, F, S, R>(settings: SyncSettings<E, F, S, R>): SyncDownBuilder<E, F> & SyncUpBuilder<E, F> {
        var inst = new SyncSettingsBuilder<E, F, S, any, any, R>();
        inst.localCollection = settings.localCollection;
        inst.primaryKeys = settings.primaryKeys;
        inst.findFilterFunc = settings.findFilterFunc;
        inst.copyObjectFunc = settings.copyObjectFunc;
        return inst;
    }


    public static fromDataCollectionAndSyncFuncs<E, F, P, S, U, R>(table: DataCollection<E, F>,
        syncDownFunc: (params: P) => PsPromise<S[], R>, syncUpFunc: (params: P, items: S[]) => PsPromise<U, R>): { addFilterFuncs: (findFilterFunc: (item: S) => F) => BuilderEnd<E, F, P, S, U, R> } {
        var tableModel = table.getDataModel();
        var tableFuncs = <DtoAllFuncs<E, S>>table.getDataModelFuncs();
        var inst = new SyncSettingsBuilder<E, F, P, S, U, R>();
        // sync settings
        inst.localCollection = table;
        inst.primaryKeys = tableModel.primaryKeys;
        inst.copyObjectFunc = tableFuncs.copyFunc;
        // sync down
        inst.syncDownFunc = syncDownFunc;
        inst.convertToLocalObjectFunc = tableFuncs.convertToLocalObjectFunc;
        // sync up
        inst.syncUpFunc = syncUpFunc;
        inst.convertToSvcObjectFunc = tableFuncs.convertToSvcObjectFunc;

        return {
            addFilterFuncs: function (findFilterFunc: (item: S) => F) {
                inst.findFilterFunc = findFilterFunc;
                return inst;
            }
        };
    }

}

module SyncSettingsBuilder {

    /** SyncSettings class
     * Settings for syncing server data to and from a local data collection
     */
    export class SyncSettingsImpl<E, F, S, R> implements SyncSettings<E, F, S, R> {
        localCollection: DataCollection<E, F>;
        primaryKeys: string[];
        findFilterFunc: (item: S) => F;
        copyObjectFunc: (item: E) => E;
        convertUrlToSyncDownFunc: (url: string) => (params: any) => PsPromise<any[], R>;
        convertUrlToSyncUpFunc: (url: string) => (params: any, items: any[]) => PsPromise<any, R>;


        constructor(localCollection: DataCollection<E, F>, primaryKeys: string | string[], findFilterFunc: (item: S) => F, copyObj: (item: E) => E,
            convertUrlToSyncDownFunc?: (url: string) => (params: any) => PsPromise<any[], R>, convertUrlToSyncUpFunc?: (url: string) => (params: any, items: any[]) => PsPromise<any, R>) {
            this.localCollection = localCollection;
            this.primaryKeys = Arrays.asArray(primaryKeys);
            this.findFilterFunc = findFilterFunc;
            this.copyObjectFunc = copyObj;
            this.convertUrlToSyncDownFunc = convertUrlToSyncDownFunc;
            this.convertUrlToSyncUpFunc = convertUrlToSyncUpFunc;
        }


        public static copy<E1, F1, S1, R1>(src: SyncSettings<E1, F1, S1, R1>) {
            return new SyncSettingsImpl(src.localCollection, src.primaryKeys, src.findFilterFunc, src.copyObjectFunc, src.convertUrlToSyncDownFunc, src.convertUrlToSyncUpFunc);
        }

    }




    /** Settings for syncing up (uploading) server data from a local data collection
     */
    export class SyncUpSettingsImpl<E, F, P, S, U, R> implements SyncUpSettings<E, F, P, S, U, R> {
        syncUpFunc: (params: P, items: S[]) => PsPromise<U, R>;
        convertToSvcObjectFunc: (item: E) => S;


        constructor(syncUpFunc: (params: P, items: S[]) => PsPromise<U, R>, toSvcObj: (item: E) => S) {
            this.syncUpFunc = syncUpFunc;
            this.convertToSvcObjectFunc = toSvcObj;
        }


        public static copy<E1, F1, P1, S1, U1, R1>(src: SyncUpSettings<E1, F1, P1, S1, U1, R1>) {
            return new SyncUpSettingsImpl(src.syncUpFunc, src.convertToSvcObjectFunc);
        }

    }




    /** Settings for syncing down (downloading) server data to a local data collection
     */
    export class SyncDownSettingsImpl<E, F, P, S, R> implements SyncDownSettings<E, F, P, S, R> {
        syncDownFunc: (params: P) => PsPromise<S[], R>;
        convertToLocalObjectFunc: (item: any) => E;
        updateLastSyncDate: (table: DataCollection<E, F>) => void;


        constructor(syncDownFunc: (params: P) => PsPromise<S[], R>, toLocalObj: (item: any) => E) {
            this.syncDownFunc = syncDownFunc;
            this.convertToLocalObjectFunc = toLocalObj;
        }


        public static copy<E1, F1, P1, S1, R1>(src: SyncDownSettings<E1, F1, P1, S1, R1>) {
            return new SyncDownSettingsImpl(src.syncDownFunc, src.convertToLocalObjectFunc);
        }

    }

}


// ==== interfaces for building sync settings ====
interface SettingsBuilder<E, F> {
    addSettingsInst<S, R>(settings: SyncSettings<E, F, S, R>): SyncDownBuilder<E, F> & SyncUpBuilder<E, F>;
    addSettings<S>(localCollection: DataCollection<E, F>, primaryKeys: string | string[], findFilterFunc: (item: S) => F, copyObjectFunc: (item: E) => E): SyncDownBuilder<E, F> & SyncUpBuilder<E, F>;
}


interface SyncDownBuilder<E, F> {
    addSyncDownSettings<P, S, R>(syncDown: SyncDownSettings<E, F, P, S, R>): SyncDownAlreadyUpBuilder<E, F, P, S, R>;
    addSyncDownFunc<P, S, R>(syncDownFunc: (params: P) => PsPromise<S[], R>, convertToLocalObjectFunc: (item: S) => E): SyncDownAlreadyUpBuilder<E, F, P, S, R>;
}

interface SyncDownBuilderWithUrl<E, F> extends SyncDownBuilder<E, F> {
    addSyncDownUrl<P, S, R>(syncDownUrl: string, convertToLocalObjectFunc: (item: S) => E): SyncDownAlreadyUpBuilderWithUrl<E, F, P, S, R>;
}

interface SyncUpBuilder<E, F> {
    addSyncUpSettings<P, S, U, R>(syncUp: SyncUpSettings<E, F, P, S, U, R>): SyncUpAlreadyDownBuilder<E, F, P, S, U, R>;
    addSyncUpFunc<P, S, U, R>(syncUpFunc: (params: P, items: S[]) => PsPromise<U, R>, convertToSvcObjectFunc: (item: E) => S): SyncUpAlreadyDownBuilder<E, F, P, S, U, R>;
}

interface SyncUpBuilderWithUrl<E, F> extends SyncUpBuilder<E, F> {
    addSyncUpUrl<P, S, U, R>(syncUpUrl: string, convertToSvcObjectFunc: (item: E) => S): SyncUpAlreadyDownBuilderWithUrl<E, F, P, S, U, R>;
}

interface SyncUpAlreadyDownBuilder<E, F, P, S, U, R> {
    addSyncDownSettings(syncDown: SyncDownSettings<E, F, P, S, R>): BuilderEnd<E, F, P, S, U, R>;
    addSyncDownFunc(syncDownFunc: (params: P) => PsPromise<S[], R>, convertToLocalObjectFunc: (item: S) => E): BuilderEnd<E, F, P, S, U, R>;
    build(): SyncSettingsWithUp<E, F, P, S, U, R>;
}

interface SyncUpAlreadyDownBuilderWithUrl<E, F, P, S, U, R> extends SyncUpAlreadyDownBuilder<E, F, P, S, U, R> {
    addSyncDownUrl(syncDownUrl: string, convertToLocalObjectFunc: (item: S) => E): BuilderEnd<E, F, P, S, U, R>;
}

interface SyncDownAlreadyUpBuilder<E, F, P, S, R> {
    addSyncUpSettings<U>(syncUp: SyncUpSettings<E, F, P, S, U, R>): BuilderEnd<E, F, P, S, U, R>;
    addSyncUpFunc<U>(syncUpFunc: (params: P, items: S[]) => PsPromise<U, R>, convertToSvcObjectFunc: (item: E) => S): BuilderEnd<E, F, P, S, U, R>;
    build(): SyncSettingsWithDown<E, F, P, S, R>;
}

interface SyncDownAlreadyUpBuilderWithUrl<E, F, P, S, R> extends SyncDownAlreadyUpBuilder<E, F, P, S, R> {
    addSyncUpUrl<U>(syncUpUrl: string, convertToSvcObjectFunc: (item: E) => S): BuilderEnd<E, F, P, S, U, R>;
}

interface BuilderEnd<E, F, P, S, U, R> extends SettingsBuilder<E, F>, SyncDownBuilder<E, F>, SyncUpBuilder<E, F> {
    build(): SyncSettingsWithUpDown<E, F, P, S, U, R>;
}


export = SyncSettingsBuilder;