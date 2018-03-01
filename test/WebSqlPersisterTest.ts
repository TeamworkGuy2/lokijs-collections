/// <reference types="chai" />
/// <reference types="mocha" />
import chai = require("chai");
import Q = require("q");
import WebSqlSpi = require("../persisters/WebSqlSpi");
import WebSqlPersister = require("../persisters/WebSqlPersister");

var asr = chai.assert;


function buildPersister() {
    var logs = {
        log: <any[][]>[],
        error: <any[][]>[],
        text: <any[][]>[],
    }
    var trace: WebSqlSpi.Trace = {
        log: (...args: any[]) => logs.log.push(args),
        error: (...args: any[]) => logs.error.push(args),
        text: (...args: any[]) => logs.text.push(args),
    };

    var origColls = [
        { name: "collA", data: <any[]>[], dirty: false },
        { name: "collB", data: <any[]>[], dirty: false },
    ];

    var newColls: typeof origColls = [
    ];

    // mock WebSqlSpi
    function newResultSet<T>(data: T[]): SQLResultSetRowList {
        (<any>data)["item"] = function item(idx: number) { return data[idx]; };
        return <any>data;
    }

    var tables: WebSqlSpi.SqlTableInfo[] = [];
    var queries: WebSqlSpi.SqlQuery[][] = [];

    var metaCnt = 0;
    var insertCnt = 0;

    //var sqlInst = WebSqlSpi.newWebSqlDbInst("test-persister", null, null, null, { trace: trace, logVerbosity: WebSqlSpi.DbUtils.logLevels.ERROR });
    var sqlInst: WebSqlPersister.WebSqlSpi = {
        executeQueries: (sqls) => {
            queries.push(sqls);
            for (var i = 0; i < sqls.length; i++) {
                var sql = sqls[i].sql;
                var sqlUpper = sql.toUpperCase();
                var str: string;
                var sqlTable: string;

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
                    var tableIdx = tables.findIndex((t) => t.name === sqlTable);
                    if (tableIdx < -1) return Q.reject("could not group table '" + sqlTable + "' because it is not an existing collection: " + sql);
                    tables.splice(tableIdx, 1);
                }
            }
            return Q.resolve([{
                insertId: insertCnt++,
                rowsAffected: sqls.length,
                rows: newResultSet([]),
            }]);
        },
        getTables: () => Q.resolve(tables)
    };

    var storageErrors: any[] = [];

    var persister = new WebSqlPersister.WebSqlAdapter(sqlInst,
        trace,
        () => origColls,
        (collName, data) => { var col = newColls[origColls.findIndex((c) => c.name === collName)]; col.data = data; return col; },
        (itm) => { delete itm["meta"]; return itm; },
        null,
        (itm) => { itm["meta"] = metaCnt++; return itm; },
        (err) => storageErrors.push(err)
    );

    return {
        persister,
        origColls,
        newColls,
        queries,
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
        pr.persister.persist(null, (collName) => {
            var res: DataPersister.WriteOptions;
            if (collName == "collA") {
                res = {
                };
            }
            else {
                res = {
                    dataColumnName: "dataStr",
                    keyGetter: (obj) => obj.userId + ":" + obj.token,
                    keyColumn: { name: "user_and_token", type: "text" },
                };
            }
            return res;
        }).then((res) => {
            // compare queries produced by persist() to expectation
            asr.equal(pr.queries.length, 2);
            asr.deepEqual(pr.queries[0], [
                { sql: "CREATE TABLE IF NOT EXISTS collA (" + WebSqlPersister.WebSqlAdapter.defaultDataColumnName + " blob)", args: [] },
                { sql: "INSERT INTO collA VALUES(?)", args: [[JSON.stringify(collA.data)]] }
            ]);
            asr.deepEqual(pr.queries[1], [
                { sql: "CREATE TABLE IF NOT EXISTS collB (user_and_token text, dataStr blob)", args: [] },
                { sql: "INSERT INTO collB VALUES(?,?)", args: collB.data.map((s) => [s.userId + ":" + s.token, JSON.stringify(s)]) }
            ]);
            done();
        }).catch((err) => done(err));
    });

});