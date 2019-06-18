
/** Utility functions used by DataPersister implementations
 * @since 2015-2-4
 */
class DbUtil<T> implements DataPersister.UtilConfig {
    /** Predefined log verbosity levels:
     * `log.NONE`: No logging.
     * `log.ERROR`: Log errors.
     * `log.DEBUG`: Verbose logging.
     */
    public static logLevels = {
        NONE: 0,
        ERROR: 1,
        DEBUG: 2
    };

    NONE: number;
    ERROR: number;
    DEBUG: number;

    public verbosity: number;
    public trace: DataPersister.DbLogger | undefined = <any>null;
    public logTimings: any;
    // Create a deferred object
    public defer: <T = any>() => DataPersister.SimpleDeferred<T>;
    public whenAll: <T = any>(promises: ArrayLike<PromiseLike<T>>) => Q.Promise<T[]>;

    private dbTypeName: string;

    isDatabase: (db: any) => db is T;


    /** DB Utility configuration:
     * `dbTypeName` the name to show in error message (ex: 'WebSQL')
     * `dbToStringId` the Object.prototype.toString() name of the type (ex: '[Database]' for WebSQL instances). NOTE: this should match type <T>
     * `defer`: specifies the function that constructs a deferred object, such as:
     * - [`when.js`](https://github.com/cujojs/when)
     * - [`Q.js`](https://github.com/kriskowal/q)
     * - [`jQuery's Deferred`](http://api.jquery.com/category/deferred-object/)
     * - Other...
     * `trace`: specifies the object used for logging messages. Default is `window.console`.
     * `logVerbosity`: specifies verbosity of logging (NONDE, ERROR or DEBUG). Default is `log.NONE`.
     */
    constructor(dbTypeName: string, dbToStringId: string, settings: DataPersister.UtilConfig) {
        this.NONE = DbUtil.logLevels.NONE;
        this.ERROR = DbUtil.logLevels.ERROR;
        this.DEBUG = DbUtil.logLevels.DEBUG;
        this.verbosity = this.NONE;
        this.logTimings = settings.logTimings;
        this.defer = settings.defer;
        this.whenAll = settings.whenAll;
        this.dbTypeName = dbTypeName;
        this.isDatabase = (db: any): db is T => this._toString(db) === dbToStringId;

        if (!this.isFunction(settings.defer)) {
            throw new Error("no 'defer' promise function option provided to " + dbTypeName + " adapter");
        }
        if (settings.trace != null && this.isFunction(settings.trace.log)) {
            this.trace = settings.trace;
        }
        if (typeof settings.verbosity !== "undefined") {
            this.verbosity = settings.verbosity;
        }
    }


    // Internal Functions

    _toString(obj: any): string { return Object.prototype.toString.call(obj); }

    isString(fn: any): fn is string { return this._toString(fn) === "[object String]"; }

    isFunction(fn: any): fn is Function { return this._toString(fn) === "[object Function]"; }

    isPromise(obj: any): obj is PromiseLike<any> { return obj && this.isFunction(obj.then); }


    /** Calls `onSuccess` or `onError` when `promise` is resolved.
     * Returns a new promise that is resolved/rejected based on the
     * values returned from the callbacks.
     */
    public pipe<T, U, V>(p: Q.IPromise<T>, onSuccess: (arg: T) => U, onError?: (err: any) => V): Q.Promise<U> {
        var self = this;
        var dfd = this.defer<U>();

        p.then(function (val) {
            var res: U = onSuccess(val);

            if (self.isPromise(res)) {
                res.then(dfd.resolve, dfd.reject);
            } else {
                dfd.resolve(res);
            }
        }, function (err) {
            if (onError) {
                err = onError(err);
            }
            if (self.isPromise(err)) {
                err.then(dfd.resolve, dfd.reject);
            } else {
                dfd.reject(err);
            }
        });

        return dfd.promise;
    }


    /** Log statement if level > verbosity
     * Usage:
     *     log(DEBUG, "Calling function", functionName);
     *     log(ERROR, "Something horrible happened:", error);
     */
    public log(level: number, ...args: any[]): void {
        var trc = this.trace;
        if (level <= this.verbosity && trc != null) {
            args.unshift(this.dbTypeName);
            if (this.isFunction(trc.text)) {
                trc.text(args, "color: purple");
            }
            else if (level === this.ERROR && this.isFunction(trc.error)) {
                trc.error(args);
            }
            else if (this.isFunction(trc.log)) {
                trc.log(args);
            }
        }
    }


    public setConsole(console: DataPersister.DbLogger): void {
        this.trace = console;
    }


    public rejectError(dfd: DataPersister.SimpleDeferred<any>, error: string | Error, options?: { exception?: any; sqlError?: SQLError; }): Q.Promise<Error> {
        if (typeof error === "string") {
            error = new Error(error);
        }

        if (options != null) {
            if (options.exception) (<any>error).exception = options.exception;
            if (options.sqlError) (<any>error).sqlError = options.sqlError;
        }

        this.log(this.ERROR, "ERROR: " + ((<any>error).exception || ((<any>error).sqlError ? (<SQLError>(<any>error).sqlError).message : (<any>error).sqlError) || error.message));

        dfd.reject(error);
        return dfd.promise;
    }


    public static getOptionsOrDefault(opts: DataPersister.WriteOptions | null | undefined, defaultOpts: DataPersister.WriteOptions | null | undefined): DataPersister.WriteOptions {
        var defaultCompress = (defaultOpts != null && defaultOpts.compress) || false;
        var defaultKeyAutoGenerate = (defaultOpts != null && defaultOpts.keyAutoGenerate) || <undefined><any>null;
        var defaultKeyGetter = (defaultOpts != null && defaultOpts.keyGetter) || <undefined><any>null;
        var defaultKeyColumn = (defaultOpts != null && defaultOpts.keyColumn) || <undefined><any>null;
        var defaultGroupByKey = (defaultOpts != null && defaultOpts.groupByKey) || <undefined><any>null;
        var defaultDataColumnName = (defaultOpts != null && defaultOpts.dataColumnName) || <undefined><any>null;
        var defaultChunkSize = (defaultOpts != null && defaultOpts.maxObjectsPerChunk) || <undefined><any>null;
        var defaultDeleteIfExists = (defaultOpts != null && defaultOpts.deleteIfExists) || false;

        return {
            compress: opts != null ? opts.compress : defaultCompress,
            keyAutoGenerate: opts != null ? opts.keyAutoGenerate : defaultKeyAutoGenerate,
            keyGetter: opts != null ? opts.keyGetter : defaultKeyGetter,
            keyColumn: opts != null ? opts.keyColumn : defaultKeyColumn,
            groupByKey: opts != null ? opts.groupByKey : defaultGroupByKey,
            dataColumnName: opts != null ? (opts.dataColumnName || defaultDataColumnName) : defaultDataColumnName,
            maxObjectsPerChunk: opts != null ? (opts.maxObjectsPerChunk || defaultChunkSize) : defaultChunkSize,
            deleteIfExists: opts != null ? opts.deleteIfExists : defaultDeleteIfExists,
        };
    }


    /** Create a timer that uses window.performance.now()
     * @param name the new timer's name
     */
    public static newTimer(name: string) {
        var useWnd = typeof window !== "undefined";
        var startMillis = (useWnd ? <number>window.performance.now() : new Date().getTime());

        var inst = {
            name: name,
            startMillis: startMillis,
            endMillis: <number | null>null,
            measure: () => {
                var endMillis = (useWnd ? <number>window.performance.now() : new Date().getTime());
                var durationMillis = endMillis - startMillis;
                inst.endMillis = endMillis;
                return durationMillis;
            },
        };
        return inst;
    }

}

export = DbUtil;