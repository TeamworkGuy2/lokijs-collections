"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="chai" />
/// <reference types="mocha" />
/// <reference types="node" />
/// <reference path="../db-collections/mem-db.d.ts" />
var chai = require("chai");
var InMemDbImpl = require("../db-collections/InMemDbImpl");
var M = require("./TestModels");
var asr = chai.assert;
function benchmarkClone(objsA, loopsA, objsB, loopsB, cloneDeep, averagedLoops) {
    if (averagedLoops === void 0) { averagedLoops = 10; }
    var _res = [];
    var warmupLoops = Math.max(Math.round(loopsA / 2), 2);
    var itemsA = objsA.length;
    var itemsB = objsB.length;
    // warmup
    for (var i = 0; i < warmupLoops; i++) {
        var resI = 0;
        // A
        for (var ii = 0; ii < itemsA; ii++) {
            resI += InMemDbImpl.cloneForInIf(objsA[ii], cloneDeep) !== null ? 1 : 0;
        }
        for (var ii = 0; ii < itemsA; ii++) {
            resI += InMemDbImpl.cloneKeysForIf(objsA[ii], cloneDeep) !== null ? 1 : 0;
        }
        for (var ii = 0; ii < itemsA; ii++) {
            resI += InMemDbImpl.cloneKeysExcludingFor(objsA[ii], cloneDeep) !== null ? 1 : 0;
        }
        for (var ii = 0; ii < itemsA; ii++) {
            resI += InMemDbImpl.cloneCloneDelete(objsA[ii], cloneDeep) !== null ? 1 : 0;
        }
        // B
        for (var ii = 0; ii < itemsB; ii++) {
            resI += InMemDbImpl.cloneForInIf(objsB[ii], cloneDeep) !== null ? 1 : 0;
        }
        for (var ii = 0; ii < itemsB; ii++) {
            resI += InMemDbImpl.cloneKeysForIf(objsB[ii], cloneDeep) !== null ? 1 : 0;
        }
        for (var ii = 0; ii < itemsB; ii++) {
            resI += InMemDbImpl.cloneKeysExcludingFor(objsB[ii], cloneDeep) !== null ? 1 : 0;
        }
        for (var ii = 0; ii < itemsB; ii++) {
            resI += InMemDbImpl.cloneCloneDelete(objsB[ii], cloneDeep) !== null ? 1 : 0;
        }
        _res.push(resI);
    }
    var resI = 0;
    // test with timers
    function for_in_if_func() {
        var start = now();
        for (var i = 0; i < loopsA; i++) {
            for (var ii = 0; ii < itemsA; ii++) {
                resI += InMemDbImpl.cloneForInIf(objsA[ii], cloneDeep) !== null ? 1 : 0;
            }
        }
        for (var i = 0; i < loopsB; i++) {
            for (var ii = 0; ii < itemsB; ii++) {
                resI += InMemDbImpl.cloneForInIf(objsB[ii], cloneDeep) !== null ? 1 : 0;
            }
        }
        return now() - start;
    }
    function keys_for_if_func() {
        var start = now();
        for (var i = 0; i < loopsA; i++) {
            for (var ii = 0; ii < itemsA; ii++) {
                resI += InMemDbImpl.cloneKeysForIf(objsA[ii], cloneDeep) !== null ? 1 : 0;
            }
        }
        for (var i = 0; i < loopsB; i++) {
            for (var ii = 0; ii < itemsB; ii++) {
                resI += InMemDbImpl.cloneKeysForIf(objsB[ii], cloneDeep) !== null ? 1 : 0;
            }
        }
        return now() - start;
    }
    function keys_excluding_for_func() {
        var start = now();
        for (var i = 0; i < loopsA; i++) {
            for (var ii = 0; ii < itemsA; ii++) {
                resI += InMemDbImpl.cloneKeysExcludingFor(objsA[ii], cloneDeep) !== null ? 1 : 0;
            }
        }
        for (var i = 0; i < loopsB; i++) {
            for (var ii = 0; ii < itemsB; ii++) {
                resI += InMemDbImpl.cloneKeysExcludingFor(objsB[ii], cloneDeep) !== null ? 1 : 0;
            }
        }
        return now() - start;
    }
    function clone_delete_func() {
        var start = now();
        for (var i = 0; i < loopsA; i++) {
            for (var ii = 0; ii < itemsA; ii++) {
                resI += InMemDbImpl.cloneCloneDelete(objsA[ii], cloneDeep) !== null ? 1 : 0;
            }
        }
        for (var i = 0; i < loopsB; i++) {
            for (var ii = 0; ii < itemsB; ii++) {
                resI += InMemDbImpl.cloneCloneDelete(objsB[ii], cloneDeep) !== null ? 1 : 0;
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
        itemsA: itemsA,
        loopsA: loopsA,
        itemsB: itemsB,
        loopsB: loopsB,
        _res: _res,
        clone_delete: parseFloat((tasksAndTimes[0].totalTime / (averagedLoops * 3)).toFixed(3)),
        for_in_if: parseFloat((tasksAndTimes[1].totalTime / (averagedLoops * 3)).toFixed(3)),
        keys_excluding_for: parseFloat((tasksAndTimes[2].totalTime / (averagedLoops * 3)).toFixed(3)),
        keys_for_if: parseFloat((tasksAndTimes[3].totalTime / (averagedLoops * 3)).toFixed(3)),
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
    else if (typeof window !== "undefined") {
        return window.performance.now();
    }
    return Date.now();
}
suite("clone benchmark", function cloneBenchmark() {
    this.timeout(15000);
    test("clone benchmark", function cloneBenchmark(done) {
        M.rebuildItems();
        var itemsA = repeat([M.itemA1, M.itemA2, M.itemA3], 10);
        var itemsB = repeat([M.itemB1, M.itemB2, M.itemB3], 5);
        var res = benchmarkClone(itemsA, 500, itemsB, 1000, true, 10);
        delete res._res;
        console.log("results (ms) " + JSON.stringify(res, null, "  "));
        done();
    });
});
