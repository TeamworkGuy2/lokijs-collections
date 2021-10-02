import chai = require("chai");
import Collection = require("../../db-collections/Collection");
import Resultset = require("../../db-collections/Resultset");
import M = require("../TestModels");

var asr = chai.assert;

suite("Testing comparator helpers", function () {
    var ops = Resultset.LokiOps;

    test("$eq works as expected", function () {
        asr.isTrue(ops.$eq(true, true));
        asr.isFalse(ops.$eq(true, false));
    });

    test("$aeq works as expected", function () {
        asr.isTrue(ops.$aeq(4, "4"));
        asr.isTrue(ops.$aeq(4, 4));
        asr.isFalse(ops.$aeq(3, 2));
        asr.isFalse(ops.$aeq(3, "three"));
        asr.isTrue(ops.$aeq("3", 3));
        asr.isTrue(ops.$aeq("1.23", 1.23));
    });

    test("$ne works as expected", function () {
        asr.isFalse(ops.$ne(true, true));
        asr.isTrue(ops.$ne(true, false));
    });

    test("$in works as expected", function () {
        asr.isTrue(ops.$in(4, [1, 3, 4]));
        asr.isFalse(ops.$in(8, [1, 3, 4]));
    });

    //test("$nin works as expected", function () {
    //    asr.isFalse(ops.$nin(4, [1, 3, 4]));
    //    asr.isTrue(ops.$nin(8, [1, 3, 4]));
    //});

    test("$gt works as expected", function () {
        //Testing strategy:
        // First, only the same type data will be compared,
        // both with and without the third optional arg.
        // This includes all primitives*.
        //
        // Then complex* values will be compared.
        //
        // Finally, some tests will be ran trying to compare
        // values of different types.
        //
        // *Primitives: boolean, null, undefined, number, string
        // *Complex: date

        asr.isFalse(ops.$gt(false, false));
        asr.isTrue(ops.$gte(false, false));
        asr.isTrue(ops.$gt(true, false));
        asr.isFalse(ops.$gt(true, true));
        asr.isTrue(ops.$gte(true, true));
        asr.isFalse(ops.$gt(null, null));
        asr.isTrue(ops.$gte(null, null));
        asr.isFalse(ops.$gt(undefined, undefined));
        asr.isTrue(ops.$gte(undefined, undefined));
        asr.isFalse(ops.$gt(-1, 0));
        asr.isFalse(ops.$gt(0, 0));
        asr.isTrue(ops.$gte(0, 0));
        asr.isTrue(ops.$gt(1, 0));
        asr.isFalse(ops.$gt(new Date(2010), new Date(2015)));
        asr.isFalse(ops.$gt(new Date(2015), new Date(2015)));
        asr.isTrue(ops.$gte(new Date(2015), new Date(2015)));
        // mixed type checking (or mixed falsy edge tests)
        asr.isTrue(ops.$gt("14", 12));
        asr.isFalse(ops.$gt(12, "14"));
        asr.isFalse(ops.$gt("10", 12));
        //asr.isTrue(ops.$gt(12, "10"));
        //asr.isTrue(ops.$gt("test", 12));
        //asr.isFalse(ops.$gt(12, "test"));
        asr.isTrue(ops.$gt(12, 0));
        asr.isFalse(ops.$gt(0, 12));
        asr.isTrue(ops.$gt(12, ""));
        asr.isFalse(ops.$gt("", 12));
    });

    test("$lt works as expected", function () {
        //Testing strategy:
        // First, only the same type data will be compared,
        // both with and without the third optional arg.
        // This includes all primitives*.
        //
        // Then complex* values will be compared.
        //
        // Finally, some tests will be ran trying to compare
        // values of different types.
        //
        // *Primitives: boolean, null, undefined, number, string
        // *Complex: date
        asr.isFalse(ops.$lt(false, false));
        asr.isTrue(ops.$lte(false, false));
        asr.isFalse(ops.$lt(true, false));
        asr.isFalse(ops.$lt(true, true));
        asr.isTrue(ops.$lte(true, true));
        asr.isFalse(ops.$lt(null, null));
        asr.isTrue(ops.$lte(null, null));
        asr.isFalse(ops.$lt(undefined, undefined));
        asr.isTrue(ops.$lte(undefined, undefined));
        asr.isTrue(ops.$lt(-1, 0));
        asr.isFalse(ops.$lt(0, 0));
        asr.isTrue(ops.$lte(0, 0));
        asr.isFalse(ops.$lt(1, 0));
        asr.isTrue(ops.$lt(new Date(2010), new Date(2015)));
        asr.isFalse(ops.$lt(new Date(2015), new Date(2015)));
        asr.isTrue(ops.$lte(new Date(2015), new Date(2015)));
        // mixed type checking (or mixed falsy edge tests)
        asr.isTrue(ops.$lt("12", 14));
        asr.isFalse(ops.$lt(14, "12"));
        asr.isTrue(ops.$lt("10", 12));
        asr.isFalse(ops.$lt(12, "10"));
        //asr.isFalse(ops.$lt("test", 12));
        //asr.isTrue(ops.$lt(12, "test"));
        asr.isFalse(ops.$lt(12, 0));
        asr.isTrue(ops.$lt(0, 12));
        asr.isFalse(ops.$lt(12, ""));
        asr.isTrue(ops.$lt("", 12));
    });

});
