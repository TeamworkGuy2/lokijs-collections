var Arrays = require("../lib/ts-mortar/utils/Arrays");
/**
 * @author TeamworkGuy2
 * @since 2016-3-7
 */
var SyncSettingsBuilder = (function () {
    function SyncSettingsBuilder() {
    }
    SyncSettingsBuilder.prototype.addSettings = function (localCollection, primaryKeys, findFilterFunc, copyObjectFunc) {
        this.localCollection = localCollection;
        this.primaryKeys = Arrays.asArray(primaryKeys);
        this.findFilterFunc = findFilterFunc;
        this.copyObjectFunc = copyObjectFunc;
        return this;
    };
    SyncSettingsBuilder.prototype.setSettings = function (settings) {
        this.localCollection = settings.localCollection;
        this.primaryKeys = settings.primaryKeys;
        this.findFilterFunc = settings.findFilterFunc;
        this.copyObjectFunc = settings.copyObjectFunc;
        return this;
    };
    SyncSettingsBuilder.prototype.addSyncDownUrl = function (syncDownUrl, convertToLocalObjectFunc) {
        this.syncDownFunc = this.convertUrlToSyncDownFunc(syncDownUrl);
        this.convertToLocalObjectFunc = convertToLocalObjectFunc;
        return this;
    };
    SyncSettingsBuilder.prototype.addSyncDownFunc = function (syncDownFunc, convertToLocalObjectFunc) {
        this.syncDownFunc = syncDownFunc;
        this.convertToLocalObjectFunc = convertToLocalObjectFunc;
        return this;
    };
    SyncSettingsBuilder.prototype.setSyncDown = function (syncDown) {
        this.syncDownFunc = syncDown.syncDownFunc;
        this.convertToLocalObjectFunc = syncDown.convertToLocalObjectFunc;
        return this;
    };
    SyncSettingsBuilder.prototype.addSyncUpUrl = function (syncUpUrl, convertToSvcObjectFunc) {
        this.syncUpFunc = this.convertUrlToSyncUpFunc(syncUpUrl);
        this.convertToSvcObjectFunc = convertToSvcObjectFunc;
        return this;
    };
    SyncSettingsBuilder.prototype.addSyncUpFunc = function (syncUpFunc, convertToSvcObjectFunc) {
        this.syncUpFunc = syncUpFunc;
        this.convertToSvcObjectFunc = convertToSvcObjectFunc;
        return this;
    };
    SyncSettingsBuilder.prototype.setSyncUp = function (syncUp) {
        this.syncUpFunc = syncUp.syncUpFunc;
        this.convertToSvcObjectFunc = syncUp.convertToSvcObjectFunc;
        return this;
    };
    SyncSettingsBuilder.prototype.build = function () {
        return this;
    };
    SyncSettingsBuilder.copy = function (src, deepCopy) {
        if (deepCopy === void 0) { deepCopy = true; }
        if (deepCopy) {
            return new SyncSettingsBuilder().setSettings(SyncSettingsBuilder.SyncSettingsImpl.copy(src))
                .setSyncDown(SyncSettingsBuilder.SyncDownSettingsImpl.copy(src))
                .setSyncUp(SyncSettingsBuilder.SyncUpSettingsImpl.copy(src));
        }
        return new SyncSettingsBuilder().setSettings(src)
            .setSyncDown(src)
            .setSyncUp(src);
    };
    SyncSettingsBuilder.fromSettingsConvert = function (localCollection, primaryKeys, findFilterFunc, copyObjectFunc, convertUrlToSyncDownFunc, convertUrlToSyncUpFunc) {
        var inst = new SyncSettingsBuilder();
        inst.localCollection = localCollection;
        inst.primaryKeys = Arrays.asArray(primaryKeys);
        inst.findFilterFunc = findFilterFunc;
        inst.copyObjectFunc = copyObjectFunc;
        inst.convertUrlToSyncDownFunc = convertUrlToSyncDownFunc;
        inst.convertUrlToSyncUpFunc = convertUrlToSyncUpFunc;
        return inst;
    };
    SyncSettingsBuilder.fromSettings = function (localCollection, primaryKeys, findFilterFunc, copyObjectFunc) {
        var inst = new SyncSettingsBuilder();
        inst.localCollection = localCollection;
        inst.primaryKeys = Arrays.asArray(primaryKeys);
        inst.findFilterFunc = findFilterFunc;
        inst.copyObjectFunc = copyObjectFunc;
        return inst;
    };
    SyncSettingsBuilder.fromSettingsObj = function (settings) {
        var inst = new SyncSettingsBuilder();
        inst.localCollection = settings.localCollection;
        inst.primaryKeys = settings.primaryKeys;
        inst.findFilterFunc = settings.findFilterFunc;
        inst.copyObjectFunc = settings.copyObjectFunc;
        return inst;
    };
    SyncSettingsBuilder.fromDataCollectionAndSyncFuncs = function (table, findFilterFunc, syncDownFunc, syncUpFunc) {
        var tableModel = table.getDataModel();
        var tableFuncs = table.getDataModelFuncs();
        var inst = new SyncSettingsBuilder();
        // sync settings
        inst.localCollection = table;
        inst.primaryKeys = tableModel.primaryKeys;
        inst.findFilterFunc = findFilterFunc;
        inst.copyObjectFunc = tableFuncs.copyFunc;
        // sync down
        inst.syncDownFunc = syncDownFunc;
        inst.convertToLocalObjectFunc = tableFuncs.convertToLocalObjectFunc;
        // sync up
        inst.syncUpFunc = syncUpFunc;
        inst.convertToSvcObjectFunc = tableFuncs.convertToSvcObjectFunc;
        return inst;
    };
    return SyncSettingsBuilder;
})();
var SyncSettingsBuilder;
(function (SyncSettingsBuilder) {
    /** SyncSettings class
     * Settings for syncing server data to and from a local data collection
     */
    var SyncSettingsImpl = (function () {
        function SyncSettingsImpl(localCollection, primaryKeys, findFilterFunc, copyObj, convertUrlToSyncDownFunc, convertUrlToSyncUpFunc) {
            this.localCollection = localCollection;
            this.primaryKeys = Arrays.asArray(primaryKeys);
            this.findFilterFunc = findFilterFunc;
            this.copyObjectFunc = copyObj;
            this.convertUrlToSyncDownFunc = convertUrlToSyncDownFunc;
            this.convertUrlToSyncUpFunc = convertUrlToSyncUpFunc;
        }
        SyncSettingsImpl.copy = function (src) {
            return new SyncSettingsImpl(src.localCollection, src.primaryKeys, src.findFilterFunc, src.copyObjectFunc, src.convertUrlToSyncDownFunc, src.convertUrlToSyncUpFunc);
        };
        return SyncSettingsImpl;
    })();
    SyncSettingsBuilder.SyncSettingsImpl = SyncSettingsImpl;
    /** Settings for syncing up (uploading) server data from a local data collection
     */
    var SyncUpSettingsImpl = (function () {
        function SyncUpSettingsImpl(syncUpFunc, toSvcObj) {
            this.syncUpFunc = syncUpFunc;
            this.convertToSvcObjectFunc = toSvcObj;
        }
        SyncUpSettingsImpl.copy = function (src) {
            return new SyncUpSettingsImpl(src.syncUpFunc, src.convertToSvcObjectFunc);
        };
        return SyncUpSettingsImpl;
    })();
    SyncSettingsBuilder.SyncUpSettingsImpl = SyncUpSettingsImpl;
    /** Settings for syncing down (downloading) server data to a local data collection
     */
    var SyncDownSettingsImpl = (function () {
        function SyncDownSettingsImpl(syncDownFunc, toLocalObj) {
            this.syncDownFunc = syncDownFunc;
            this.convertToLocalObjectFunc = toLocalObj;
        }
        SyncDownSettingsImpl.copy = function (src) {
            return new SyncDownSettingsImpl(src.syncDownFunc, src.convertToLocalObjectFunc);
        };
        return SyncDownSettingsImpl;
    })();
    SyncSettingsBuilder.SyncDownSettingsImpl = SyncDownSettingsImpl;
})(SyncSettingsBuilder || (SyncSettingsBuilder = {}));
module.exports = SyncSettingsBuilder;
