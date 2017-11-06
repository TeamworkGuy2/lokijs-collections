"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="chai" />
/// <reference types="mocha" />
var chai = require("chai");
var Q = require("q");
var WebSqlPersister = require("../persisters/WebSqlPersister");
var asr = chai.assert;
function buildPersister() {
    var logs = {
        log: [],
        error: [],
        text: [],
    };
    var trace = {
        log: function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return logs.log.push(args);
        },
        error: function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return logs.error.push(args);
        },
        text: function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return logs.text.push(args);
        },
    };
    var origColls = [
        { name: "collA", data: [], dirty: false },
        { name: "collB", data: [], dirty: false },
    ];
    var newColls = [];
    // mock WebSqlSpi
    function newResultSet(data) {
        data["item"] = function item(idx) { return data[idx]; };
        return data;
    }
    var tables = [];
    var queries = [];
    var metaCnt = 0;
    var insertCnt = 0;
    //var sqlInst = WebSqlSpi.newWebSqlDbInst("test-persister", null, null, null, { trace: trace, logVerbosity: WebSqlSpi.DbUtils.logLevels.ERROR });
    var sqlInst = {
        executeQueries: function (sqls) {
            queries.push(sqls);
            for (var i = 0; i < sqls.length; i++) {
                var sql = sqls[i].sql;
                var sqlUpper = sql.toUpperCase();
                var str;
                var sqlTable;
                if (sqlUpper.startsWith(str = "CREATE TABLE IF NOT EXISTS ")) {
                    sqlTable = sql.substring(str.length, sql.indexOf(' ', str.length));
                    tables.push({ name: sqlTable, type: "", sql: sqls[i].sql });
                }
                else if (sqlUpper.startsWith(str = "CREATE TABLE ")) {
                    sqlTable = sql.substring(str.length, sql.indexOf(' ', str.length));
                    tables.push({ name: sqlTable, type: "", sql: sqls[i].sql });
                }
                else if (sqlUpper.startsWith(str = "DROP TABLE ")) {
                    sqlTable = sql.substring(str.length, sql.indexOf(' ', str.length));
                    var tableIdx = tables.findIndex(function (t) { return t.name === sqlTable; });
                    if (tableIdx < -1)
                        return Q.reject("could not group table '" + sqlTable + "' because it is not an existing collection: " + sql);
                    tables.splice(tableIdx, 1);
                }
            }
            return Q.resolve([{
                    insertId: insertCnt++,
                    rowsAffected: sqls.length,
                    rows: newResultSet([]),
                }]);
        },
        getTables: function () { return Q.resolve(tables); }
    };
    var storageErrors = [];
    var persister = new WebSqlPersister.WebSqlAdapter(sqlInst, trace, function () { return origColls; }, function (collName, data) { var col = newColls[origColls.findIndex(function (c) { return c.name === collName; })]; col.data = data; return col; }, function (itm) { delete itm["meta"]; return itm; }, null, function (itm) { itm["meta"] = metaCnt++; return itm; }, function (err) { return storageErrors.push(err); });
    return {
        persister: persister,
        origColls: origColls,
        newColls: newColls,
        queries: queries,
    };
}
suite("WebSqlPersister", function WebSqlPersisterTest() {
    test("persist", function persistTest(done) {
        var pr = buildPersister();
        var collA = pr.origColls[0];
        var collB = pr.origColls[1];
        // mock data
        collA.data = [{ id: 1, name: "item-A1", styles: ["a-style-1", "a-style-2"] }, { id: 2, name: "item-A2", styles: ["b-style-1", "b-style-2"] }];
        collA.dirty = true;
        collB.data = [{ userId: "bill", token: "item-B1", note: "note for bill" }, { userId: "cara", token: "item-B2", note: "note for cara" }];
        collB.dirty = true;
        // persist collections
        pr.persister.persist(null, function (collName) {
            var res;
            if (collName == "collA") {
                res = {};
            }
            else {
                res = {
                    dataColumnName: "dataStr",
                    keyGetter: function (obj) { return obj.userId + ":" + obj.token; },
                    keyColumn: { name: "user_and_token", type: "text" },
                };
            }
            return res;
        }).then(function (res) {
            // compare queries produced by persist() to expectation
            asr.equal(pr.queries.length, 2);
            asr.deepEqual(pr.queries[0], [
                { sql: "CREATE TABLE IF NOT EXISTS collA (" + WebSqlPersister.WebSqlAdapter.defaultDataColumnName + " blob)", args: [] },
                { sql: "INSERT INTO collA VALUES(?)", args: [[JSON.stringify(collA.data)]] }
            ]);
            asr.deepEqual(pr.queries[1], [
                { sql: "CREATE TABLE IF NOT EXISTS collB (user_and_token text, dataStr blob)", args: [] },
                { sql: "INSERT INTO collB VALUES(?,?)", args: collB.data.map(function (s) { return [s.userId + ":" + s.token, JSON.stringify(s)]; }) }
            ]);
            done();
        }).catch(function (err) { return done(err); });
    });
});
