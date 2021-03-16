"use strict";
/** Utility functions used by DataPersister implementations
 * @since 2015-2-4
 */
var DbUtil = /** @class */ (function () {
    /** DB Utility configuration:
     * @param dbTypeName the name to show in error message (ex: 'WebSQL')
     * @param dbToStringId the Object.prototype.toString() name of the type (ex: '[Database]' for WebSQL instances). NOTE: this should match type <T>
     * @param settings configuration object with the following properties:
     * `defer`: specifies the function that constructs a deferred object, such as:
     * - Promise (native browser/node.js implementation)
     * - [`when.js`](https://github.com/cujojs/when)
     * - [`Q.js`](https://github.com/kriskowal/q)
     * - [`jQuery's Deferred`](http://api.jquery.com/category/deferred-object/)
     * - Other...
     * `whenAll`: a Promise.all() style function for the promises returned by the 'defer' object
     * `trace`: specifies the object used for logging messages. Default is `window.console`.
     * `verbosity`: specifies verbosity of logging (NONDE, ERROR or DEBUG). Default is `log.NONE`.
     * `logTimings`: whether to log query timings
     */
    function DbUtil(dbTypeName, dbToStringId, settings) {
        var _this = this;
        this.trace = null;
        this.NONE = DbUtil.logLevels.NONE;
        this.ERROR = DbUtil.logLevels.ERROR;
        this.DEBUG = DbUtil.logLevels.DEBUG;
        this.verbosity = this.NONE;
        this.logTimings = settings.logTimings;
        this.defer = settings.defer;
        this.whenAll = settings.whenAll;
        this.dbTypeName = dbTypeName;
        this.isDatabase = function (db) { return _this._toString(db) === dbToStringId; };
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
    DbUtil.prototype._toString = function (obj) { return Object.prototype.toString.call(obj); };
    DbUtil.prototype.isString = function (fn) { return this._toString(fn) === "[object String]"; };
    DbUtil.prototype.isFunction = function (fn) { return this._toString(fn) === "[object Function]"; };
    DbUtil.prototype.isPromise = function (obj) { return obj && this.isFunction(obj.then); };
    /** Calls `onSuccess` or `onError` when `promise` is resolved.
     * Returns a new promise that is resolved/rejected based on the
     * values returned from the callbacks.
     */
    DbUtil.prototype.pipe = function (p, onSuccess, onError) {
        var self = this;
        var dfd = this.defer();
        p.then(function (val) {
            var res = onSuccess(val);
            if (self.isPromise(res)) {
                res.then(dfd.resolve, dfd.reject);
            }
            else {
                dfd.resolve(res);
            }
        }, function (err) {
            if (onError) {
                err = onError(err);
            }
            if (self.isPromise(err)) {
                err.then(dfd.resolve, dfd.reject);
            }
            else {
                dfd.reject(err);
            }
        });
        return dfd.promise;
    };
    /** Log statement if level > verbosity
     * Usage:
     *     log(DEBUG, "Calling function", functionName);
     *     log(ERROR, "Something horrible happened:", error);
     */
    DbUtil.prototype.log = function (level) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
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
    };
    DbUtil.prototype.setConsole = function (console) {
        this.trace = console;
    };
    DbUtil.prototype.rejectError = function (dfd, error, options) {
        if (typeof error === "string") {
            error = new Error(error);
        }
        if (options != null) {
            if (options.exception)
                error.exception = options.exception;
            if (options.sqlError)
                error.sqlError = options.sqlError;
        }
        this.log(this.ERROR, "ERROR: " + (error.exception || (error.sqlError ? error.sqlError.message : error.sqlError) || error.message));
        dfd.reject(error);
        return dfd.promise;
    };
    DbUtil.getOptionsOrDefault = function (opts, defaultOpts) {
        var defaultCompress = (defaultOpts != null && defaultOpts.compress) || false;
        var defaultKeyAutoGenerate = (defaultOpts != null && defaultOpts.keyAutoGenerate) || null;
        var defaultKeyGetter = (defaultOpts != null && defaultOpts.keyGetter) || null;
        var defaultKeyColumn = (defaultOpts != null && defaultOpts.keyColumn) || null;
        var defaultGroupByKey = (defaultOpts != null && defaultOpts.groupByKey) || null;
        var defaultDataColumnName = (defaultOpts != null && defaultOpts.dataColumnName) || null;
        var defaultChunkSize = (defaultOpts != null && defaultOpts.maxObjectsPerChunk) || null;
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
    };
    /** Create a timer that uses window.performance.now()
     * @param name the new timer's name
     */
    DbUtil.newTimer = function (name) {
        var useWnd = typeof window !== "undefined";
        var startMillis = (useWnd ? window.performance.now() : new Date().getTime());
        var inst = {
            name: name,
            startMillis: startMillis,
            endMillis: null,
            measure: function () {
                var endMillis = (useWnd ? window.performance.now() : new Date().getTime());
                var durationMillis = endMillis - startMillis;
                inst.endMillis = endMillis;
                return durationMillis;
            },
        };
        return inst;
    };
    /** Predefined log verbosity levels:
     * `log.NONE`: No logging.
     * `log.ERROR`: Log errors.
     * `log.DEBUG`: Verbose logging.
     */
    DbUtil.logLevels = {
        NONE: 0,
        ERROR: 1,
        DEBUG: 2
    };
    return DbUtil;
}());
module.exports = DbUtil;
