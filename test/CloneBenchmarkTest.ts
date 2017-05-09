/// <reference types="chai" />
/// <reference types="mocha" />
/// <reference types="node" />
/// <reference path="../../definitions/lokijs/lokijs.d.ts" />
import chai = require("chai");
import InMemDbImpl = require("../db-collections/InMemDbImpl");
import M = require("./TestModels");

var asr = chai.assert;


function benchmarkClone<T>(objs: T[], loops: number, cloneDeep?: boolean | ((obj: any) => any), averagedLoops = 10): {
    items: number;
    loops: number;
    clone_delete: number;
    for_in_if: number;
    keys_for_if: number;
    keys_excluding_for: number;
    _res: any;
} {
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
        items,
        loops,
        _res,
        clone_delete: tasksAndTimes[0].totalTime / (averagedLoops * 3),
        for_in_if: tasksAndTimes[1].totalTime / (averagedLoops * 3),
        keys_excluding_for: tasksAndTimes[2].totalTime / (averagedLoops * 3),
        keys_for_if: tasksAndTimes[3].totalTime / (averagedLoops * 3),
    }
}

function repeat<T>(objs: T[], times: number): T[] {
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

    test("clone benchmark", function cloneBenchmark(done: MochaDone) {
        M.rebuildItems();
        var items = repeat([M.itemA1, M.itemA2, M.itemA3], 10);
        var res = benchmarkClone(items, 1000, true, 10);

        delete res._res;
        console.log("results (ms) " + JSON.stringify(res, null, "  "));

        done();
    });

});
