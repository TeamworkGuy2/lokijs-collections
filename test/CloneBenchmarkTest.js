"use strict";
/// <reference path="../../definitions/chai/chai.d.ts" />
/// <reference path="../../definitions/mocha/mocha.d.ts" />
/// <reference path="../../definitions/lokijs/lokijs.d.ts" />
var chai = require("chai");
var InMemDbImpl = require("../db-collections/InMemDbImpl");
var M = require("./TestModels");
var asr = chai.assert;
function benchmarkClone(objs, loops, cloneDeep, averagedLoops) {
    if (averagedLoops === void 0) { averagedLoops = 10; }
    var _res = [];
    var warmupLoops = Math.max(Math.round(loops / 2), 2);
    var items = objs.length;
    // warmup
    for (var i = 0; i < warmupLoops; i++) {
        var resI = 0;
        for (var ii = 0; ii < items; ii++) {
            resI += InMemDbImpl.cloneForInIf(objs[ii], cloneDeep) !== null ? 1 : 0;
        }
        for (var ii = 0; ii < items; ii++) {
            resI += InMemDbImpl.cloneKeysForIf(objs[ii], cloneDeep) !== null ? 1 : 0;
        }
        for (var ii = 0; ii < items; ii++) {
            resI += InMemDbImpl.cloneKeysExcludingFor(objs[ii], cloneDeep) !== null ? 1 : 0;
        }
        for (var ii = 0; ii < items; ii++) {
            resI += InMemDbImpl.cloneCloneDelete(objs[ii], cloneDeep) !== null ? 1 : 0;
        }
        _res.push(resI);
    }
    var resI = 0;
    // test with timers
    function for_in_if_func() {
        var start = now();
        for (var i = 0; i < loops; i++) {
            for (var ii = 0; ii < items; ii++) {
                resI += InMemDbImpl.cloneForInIf(objs[ii], cloneDeep) !== null ? 1 : 0;
            }
        }
        return now() - start;
    }
    function keys_for_if_func() {
        var start = now();
        for (var i = 0; i < loops; i++) {
            for (var ii = 0; ii < items; ii++) {
                resI += InMemDbImpl.cloneKeysForIf(objs[ii], cloneDeep) !== null ? 1 : 0;
            }
        }
        return now() - start;
    }
    function keys_excluding_for_func() {
        var start = now();
        for (var i = 0; i < loops; i++) {
            for (var ii = 0; ii < items; ii++) {
                resI += InMemDbImpl.cloneKeysExcludingFor(objs[ii], cloneDeep) !== null ? 1 : 0;
            }
        }
        return now() - start;
    }
    function clone_delete_func() {
        var start = now();
        for (var i = 0; i < loops; i++) {
            for (var ii = 0; ii < items; ii++) {
                resI += InMemDbImpl.cloneCloneDelete(objs[ii], cloneDeep) !== null ? 1 : 0;
            }
        }
        return now() - start;
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
        items: items,
        loops: loops,
        _res: _res,
        clone_delete: tasksAndTimes[0].totalTime / (averagedLoops * 3),
        for_in_if: tasksAndTimes[1].totalTime / (averagedLoops * 3),
        keys_excluding_for: tasksAndTimes[2].totalTime / (averagedLoops * 3),
        keys_for_if: tasksAndTimes[3].totalTime / (averagedLoops * 3),
    };
}
function repeat(objs, times) {
    var len = objs.length;
    var res = new Array(len * times);
    for (var i = 0; i < times; i++) {
        for (var j = 0; j < len; j++) {
            res[(i * len) + j] = objs[j];
        }
    }
    return res;
}
function now() {
    if (process) {
        var hrTime = process.hrtime();
        return hrTime[0] * 1000 + hrTime[1] / 1000000;
    }
    else if (window) {
        return window.performance.now();
    }
    return Date.now();
}
suite("clone benchmark", function cloneBenchmark() {
    this.timeout(15000);
    test("clone benchmark", function cloneBenchmark(done) {
        M.rebuildItems();
        var items = repeat([M.itemA1, M.itemA2, M.itemA3], 10);
        var res = benchmarkClone(items, 1000, true, 10);
        delete res._res;
        console.log("results (ms) " + JSON.stringify(res, null, "  "));
        done();
    });
});
