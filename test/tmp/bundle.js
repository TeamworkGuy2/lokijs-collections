(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
var Arrays;
(function (Arrays) {
    Arrays.EMPTY_ARRAY = Object.freeze([]);
    /** Add all of the values in 'toAdd' to the 'src' array
     * @returns the source array
     */
    function addAll(src, toAdd) {
        if (toAdd != null && toAdd.length > 0) {
            Array.prototype.push.apply(src, toAdd);
        }
        return src;
    }
    Arrays.addAll = addAll;
    /** Transform and add the elements from one array to another
     * @param src the array to add elements to
     * @param toAdd the elements to transform and add
     * @param transformer a function to transform the 'toAdd' values before adding them to 'src'
     */
    function addAllTransform(src, toAdd, transformer) {
        for (var i = 0, size = toAdd.length; i < size; i++) {
            src.push(transformer(toAdd[i]));
        }
        return src;
    }
    Arrays.addAllTransform = addAllTransform;
    /** Given an array or an object, return the array, or a new array containing the object as it's only element
     * @param data the object or array
     * @param copyToNewAry optional (default: false) if the data is an array, copy the items into a new array
     */
    function asArray(data, copyToNewAry) {
        if (Array.isArray(data)) {
            return copyToNewAry ? data.slice() : data;
        }
        else {
            return [data];
        }
    }
    Arrays.asArray = asArray;
    /** Check if an array is not null and has any items
     * @param ary the array to check
     * @returns true if the array is not null and has a length greater than 0
     */
    function hasAny(ary) {
        return ary != null && ary.length > 0;
    }
    Arrays.hasAny = hasAny;
    /** Given an array or an object, return true if it is an object or an array containing one element, false if the array is empty or contains more than 1 element
     * @param data the object or array
     */
    function isOneItem(data) {
        return Array.isArray(data) ? data.length === 1 : true;
    }
    Arrays.isOneItem = isOneItem;
    /** Given an array or an object, return the object or the first element if the array contains 1 element, else return null if the array is empty or contains more than 1 element
     * @param data the object or array
     */
    function getIfOneItem(data) {
        return Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data;
    }
    Arrays.getIfOneItem = getIfOneItem;
    /** Perform a binary search of a property in an array of values and return the index.
     * For example: Arrays.binarySearch([{key: 3}, {key: 10}, {key: 14}, {key: 15}], "key", 14)
     * returns: 2 indicating that the 3rd array element matches
     *
     * For example: Arrays.binarySearch([{key: 3}, {key: 10}, {key: 14}, {key: 15}], "id", 13)
     * returns: -3 indicating that no matching element was found,
     * but if a matching element did exist in the array, it would be at index 3
     */
    function binarySearch(ary, comparatorPropName, searchValue) {
        var low = 0;
        var high = ary.length - 1;
        while (low <= high) {
            var mid = Math.floor((low + high) / 2);
            var midVal = ary[mid];
            var compare = midVal[comparatorPropName] - searchValue;
            if (compare < 0) {
                low = mid + 1;
            }
            else if (compare > 0) {
                high = mid - 1;
            }
            else {
                return mid;
            }
        }
        return -(low + 1);
    }
    Arrays.binarySearch = binarySearch;
    /** Remove all values from an array
     */
    function clear(ary) {
        if (ary != null) {
            ary.length = 0;
        }
    }
    Arrays.clear = clear;
    /** Returns a new array containing the elements from 'ary1' followed by the elements from 'ary2'
     */
    function concat(ary1, ary2) {
        if (ary1 != null && ary2 != null) {
            return ary1.concat(ary2);
        }
        else {
            return (ary1 != null ? ary1.slice() : (ary2 != null ? ary2.slice() : []));
        }
    }
    Arrays.concat = concat;
    /** Check whether all of the values in the second array are contained in the first array
     * @param ary the array of values
     * @param searchFor the values to search for
     * @returns true if all of 'searchFor' values are contained in 'ary'
     */
    function containsAll(ary, searchFor) {
        if (ary == null || searchFor == null) {
            return false;
        }
        for (var i = 0, size = searchFor.length; i < size; i++) {
            if (ary.indexOf(searchFor[i]) < 0) {
                return false;
            }
        }
        return true;
    }
    Arrays.containsAll = containsAll;
    /** Check whether any of the values in the second array are contained in the first array
     * @param ary the array of values
     * @param searchFor the values to search for
     * @returns true if any of 'searchFor' values are contained in 'ary'
     */
    function containsAny(ary, searchFor) {
        if (ary == null || searchFor == null) {
            return false;
        }
        for (var i = 0, size = searchFor.length; i < size; i++) {
            if (ary.indexOf(searchFor[i]) > -1) {
                return true;
            }
        }
        return false;
    }
    Arrays.containsAny = containsAny;
    /** Count the number of elements in an array that match a filter
     * @param ary the array of values
     * @param filter the filter to use on 'ary'
     * @returns the number of 'ary' elements that return a truthy value when passed through the 'filter' function
     */
    function count(ary, filter) {
        var res = 0;
        for (var i = 0, size = ary.length; i < size; i++) {
            if (filter(ary[i], i, ary)) {
                res++;
            }
        }
        return res;
    }
    Arrays.count = count;
    /** Get the difference between two arrays. Also known as the symmetric difference (https://en.wikipedia.org/wiki/Symmetric_difference).
     * NOTE: duplicate values in either array are considered unique.  If there are two of the same values in 'ary1', then 'ary2' must contain two of those values to cancel out both of the values from 'ary1'.
     * For example: Arrays.diff([1, 2, 3], [2, 4])
     * returns: [4, 1, 3]
     * which represents the differences between 'ary1' and 'ary2' (note: the returned array order is undefined)
     *
     * @param ary1 the first array to compare
     * @param ary2 the second array to compare
     * @returns of values that exist in only one of the input arrays
     * @see diff()
     */
    function diff(ary1, ary2, equal) {
        var diffRes = (equal != null ? diffPartsCustomEquality(ary1, ary2, equal) : diffParts(ary1, ary2));
        var looseDiff = Array.prototype.concat.apply(diffRes.added, diffRes.removed);
        return looseDiff;
    }
    Arrays.diff = diff;
    /** Return the difference between two arrays as elements added and removed from the first array.
     * Items which only exist in 'ary1' are called 'removed'.
     * Items which only exist in 'ary2' are called 'added'.
     * NOTE: duplicate values in either array are considered unique.  If there are two of the same values in 'ary1', then 'ary2' must contain two of those values to cancel out both of the values from 'ary1'.
     *
     * For example: Arrays.diffParts([1, 2, 3], [2, 4])
     * returns: { added: [4], removed: [1, 3]},
     * which are the values to add and remove from 'ary1' to convert it to 'ary2'
     *
     * @param ary1 the master/original array to base differences on
     * @param ary2 the branch/new array to find differences in
     * @returns with 'added' and 'removed' arrays of values from 'ary1' and 'ary2'
     * @see looseDiff()
     */
    function diffParts(ary1, ary2) {
        if (ary1 == null || ary2 == null || !Array.isArray(ary1) || !Array.isArray(ary2)) {
            if (ary1 == null && ary2 == null) {
                return { added: [], removed: [] };
            }
            // else, incorrect arguments
            if ((ary1 != null && !Array.isArray(ary1)) || (ary2 != null && !Array.isArray(ary2)) || ary1 === undefined || ary2 === undefined) {
                throw new Error("incorrect usage ([" + ary1 + "], [" + ary2 + "]), expected (Array ary1, Array ary2)");
            }
            // if one array is null and the other is not, the difference is just the non-null array's values
            if (ary1 == null && ary2 != null) {
                return {
                    added: ary2.slice(),
                    removed: []
                };
            }
            else /*if (ary1 != null && ary2 == null)*/ {
                return {
                    added: [],
                    removed: ary1.slice()
                };
            }
        }
        var added = [];
        var removed = [];
        var ary2Used = [];
        var ary1Size = ary1.length;
        var ary2Size = ary2.length;
        // keep track of each element in 'ary2' that does not exist in 'ary1'
        for (var i = 0; i < ary1Size; i++) {
            var elem1 = ary1[i];
            var matchingIdx2 = -1;
            for (var ii = 0; ii < ary2Size; ii++) {
                if (ary2Used[ii] !== true && elem1 === ary2[ii]) {
                    matchingIdx2 = ii;
                    break;
                }
            }
            // items that only exist in 'ary1' are 'removed'
            if (matchingIdx2 === -1) {
                removed.push(ary1[i]);
            }
            else {
                ary2Used[matchingIdx2] = true;
            }
        }
        // items that only exist in 'ary2' are 'added'
        for (var ii = 0; ii < ary2Size; ii++) {
            if (!ary2Used[ii]) {
                added.push(ary2[ii]);
            }
        }
        return {
            added: added,
            removed: removed
        };
    }
    Arrays.diffParts = diffParts;
    /** Return the difference between two arrays as elements added and removed from the first array.
     * Items which only exist in 'ary1' are called 'removed'.
     * Items which only exist in 'ary2' are called 'added'.
     * NOTE: duplicate values in either array are considered unique.  If there are two of the same values in 'ary1', then 'ary2' must contain two of those values to cancel out both of the values from 'ary1'.
     *
     * For example: Arrays.diffParts([1, 2, 3], [2, 4])
     * returns: { added: [4], removed: [1, 3]},
     * which are the values to add and remove from 'ary1' to convert it to 'ary2'
     *
     * @param ary1 the master/original array to base differences on
     * @param ary2 the branch/new array to find differences in
     * @returns with 'added' and 'removed' arrays of values from 'ary1' and 'ary2'
     * @see looseDiff()
     */
    function diffPartsCustomEquality(ary1, ary2, equal) {
        if (ary1 == null || ary2 == null || !Array.isArray(ary1) || !Array.isArray(ary2)) {
            if (ary1 == null && ary2 == null) {
                return { added: [], removed: [] };
            }
            // else, incorrect arguments
            if ((ary1 != null && !Array.isArray(ary1)) || (ary2 != null && !Array.isArray(ary2)) || ary1 === undefined || ary2 === undefined) {
                throw new Error("incorrect usage ([" + ary1 + "], [" + ary2 + "]), expected (Array ary1, Array ary2)");
            }
            // if one array is null and the other is not, the difference is just the non-null array's values
            if (ary1 == null && ary2 != null) {
                return {
                    added: ary2.slice(),
                    removed: []
                };
            }
            else /*if (ary1 != null && ary2 == null)*/ {
                return {
                    added: [],
                    removed: ary1.slice()
                };
            }
        }
        var added = [];
        var removed = [];
        var ary2Used = [];
        var ary1Size = ary1.length;
        var ary2Size = ary2.length;
        // keep track of each element in 'ary2' that does not exist in 'ary1'
        for (var i = 0; i < ary1Size; i++) {
            var elem1 = ary1[i];
            var matchingIdx2 = -1;
            for (var ii = 0; ii < ary2Size; ii++) {
                if (ary2Used[ii] !== true && equal(elem1, ary2[ii])) {
                    matchingIdx2 = ii;
                    break;
                }
            }
            // items that only exist in 'ary1' are 'removed'
            if (matchingIdx2 === -1) {
                removed.push(ary1[i]);
            }
            else {
                ary2Used[matchingIdx2] = true;
            }
        }
        // items that only exist in 'ary2' are 'added'
        for (var ii = 0; ii < ary2Size; ii++) {
            if (!ary2Used[ii]) {
                added.push(ary2[ii]);
            }
        }
        return {
            added: added,
            removed: removed
        };
    }
    Arrays.diffPartsCustomEquality = diffPartsCustomEquality;
    function distinct(ary, propName) {
        if (ary == null || ary.length < 2) {
            return ary || null;
        }
        var res = [ary[0]];
        if (propName == null) {
            for (var i = 1, size = ary.length; i < size; i++) {
                if (res.indexOf(ary[i]) === -1) {
                    res.push(ary[i]);
                }
            }
        }
        else {
            for (var i = 1, size = ary.length; i < size; i++) {
                if (Arrays.indexOfProp(res, propName, ary[i][propName]) === -1) {
                    res.push(ary[i]);
                }
            }
        }
        return res;
    }
    Arrays.distinct = distinct;
    function fastRemove(ary, value) {
        var aryLen = 0;
        if (ary == null || (aryLen = ary.length) === 0) {
            return ary;
        }
        var idx = ary.indexOf(value);
        if (idx > -1) {
            ary[idx] = ary[aryLen - 1];
            ary.pop();
        }
        return ary;
    }
    Arrays.fastRemove = fastRemove;
    function fastRemoveIndex(ary, index) {
        var aryLen = 0;
        if (ary == null || (aryLen = ary.length) === 0) {
            return ary;
        }
        if (aryLen > 1) {
            ary[index] = ary[aryLen - 1];
        }
        ary.pop();
        return ary;
    }
    Arrays.fastRemoveIndex = fastRemoveIndex;
    /** Split an array of values into matching and non-matching arrays using a filter
     * For example: Arrays.filterSplit([1, 2, 3, 4, 5], function (value, idx, ary) { return value % 2 == 0; })
     * returns: { all: [1, 2, 3, 4, 5], matching: [2, 4], notMatching: [1, 3, 5] }
     *
     * @param ary the array of values to filter
     * @param filterFunc the function to filter the values,
     * true stores items in the returned 'matching' property,
     * false stores items in the returned 'notMatching' property
     * @returns a filter result object contains the original array 'all' and arrays of 'matching' and 'notMatching' items
     */
    function filterSplit(ary, filterFunc) {
        if (ary == null) {
            return toBiFilterResult([], [], []);
        }
        if (typeof filterFunc !== "function") {
            throw new Error("incorrect parameter 'filterFunc', must be a 'function(value: E, index: number, array: E[]): boolean'");
        }
        var matching = [];
        var notMatching = [];
        for (var i = 0, size = ary.length; i < size; i++) {
            var value = ary[i];
            if (filterFunc(value, i, ary)) {
                matching.push(value);
            }
            else {
                notMatching.push(value);
            }
        }
        return toBiFilterResult(ary, matching, notMatching);
    }
    Arrays.filterSplit = filterSplit;
    // convert an array of items and arrays containing matching and non-matching items to an 'BiFilterResult' object
    function toBiFilterResult(all, matching, notMatching) {
        return {
            all: all,
            matching: matching,
            notMatching: notMatching
        };
    }
    /** Search for objects in an array containing a property matching a given input property.
     * For example: Arrays.findAllProp([ {name: "billy", value: 5}, {name: "sam", value: 5}, {name: "overhill", value: 3} ], "value", 5)
     * returns: {name: "billy", value: 5}, {name: "sam", value: 5}
     * because the matching object has a property "value" with a value of 5
     *
     * @param ary the array to search
     * @param propName the name of the property to search for on each object
     * @param propValue the property value to compare
     * @returns an array of objects containing properties named 'propName' with values equal to 'propValue',
     * returns a new empty array if no matching object was found
     */
    function findMatchingProps(ary, propName, propValue) {
        if (ary == null || propName == null || propValue === undefined) {
            return null;
        }
        var res = [];
        for (var i = 0, size = ary.length; i < size; i++) {
            if (ary[i][propName] === propValue) {
                res.push(ary[i]);
            }
        }
        return res;
    }
    Arrays.findMatchingProps = findMatchingProps;
    /** Return the first matching value in an array using a filter function, null if no matches.
     * Optional: throw an exception if more than one result is found.
     * For example: Arrays.first([ {key: 27, value: "A"}, {key: 46, value: "B"}, {key: 84, value: "C"}, {key: 84, value: "D"} ], function (obj) { return obj.key === 84; })
     * returns: {key: 84, value: "C"}
     *
     * @param ary the array of values to search
     * @param filter the filter to apply to 'ary'
     * @returns the first (lowest index) value passed to 'filter' from 'ary' that returns true, or null if a match cannot be found
     */
    function first(ary, filter, ensureOne) {
        if (ensureOne === void 0) { ensureOne = false; }
        var idx = firstIndex(ary, filter, ensureOne);
        return idx < 0 ? null : ary[idx];
    }
    Arrays.first = first;
    /** Return the index of the first matching value in an array using a filter function, null if no matches.
     * @see #first()
     */
    function firstIndex(ary, filter, ensureOne) {
        if (ensureOne === void 0) { ensureOne = false; }
        if (ary == null || filter == null) {
            return -1;
        }
        var resultIdx = -1;
        var resultCount = 0;
        for (var i = 0, size = ary.length; i < size; i++) {
            if (filter(ary[i], i, ary) === true) {
                if (resultCount === 0) {
                    resultIdx = i;
                    if (!ensureOne) {
                        resultCount++;
                        break;
                    }
                }
                resultCount++;
                throw new Error("found multiple results, expected to find one");
            }
        }
        if (resultCount === 1) {
            return resultIdx;
        }
        return -1;
    }
    Arrays.firstIndex = firstIndex;
    function last(ary, filterFunc) {
        var idx = lastIndex(ary, filterFunc);
        return idx < 0 ? null : ary[idx];
    }
    Arrays.last = last;
    /** Return the last value in an array that matches a filter, null if no matches
     * @param ary the array of values to search
     * @param filterFunc the filter to apply
     * @returns the highest-index value passed to 'filterFunc' from 'ary' that returns true, null if no value returns true
     */
    function lastIndex(ary, filterFunc) {
        if (ary == null) {
            return -1;
        }
        for (var i = ary.length - 1; i > -1; i--) {
            if (filterFunc(ary[i], i, ary) == true) {
                return i;
            }
        }
        return -1;
    }
    Arrays.lastIndex = lastIndex;
    /** Search for an object in an array containing a property matching a given input property.
     * Optional: throw an exception if more than one result is found.
     * For example: Arrays.firstProp([ {name: "billy", value: 4}, {name: "sam", value: 5}, {name: "will", value: 5} ], "value", 5)
     * returns: {name: "sam", value: 5}
     * Or example: Arrays.firstProp([ {name: "billy", value: 4}, {name: "sam", value: 4}, {name: "will", value: 5} ], "value", 5, true)
     * throws an error because the value appears more than once and the 'ensureOne' parameter = true
     *
     * @param ary the array of values to search
     * @param propName the name of the property  to search for on each object
     * @param propValue the property value to compare
     * @returns the first (lowest index) matching value from the input array, or null if a result cannot be found
     */
    function firstProp(ary, propName, propValue, ensureOne) {
        if (ensureOne === void 0) { ensureOne = false; }
        if (ary == null || propName == null) {
            return null;
        }
        var result = null;
        var resultCount = 0;
        for (var i = 0, size = ary.length; i < size; i++) {
            var obj = ary[i];
            if (obj != null && obj[propName] === propValue) {
                if (resultCount === 0) {
                    result = obj;
                    if (!ensureOne) {
                        resultCount++;
                        break;
                    }
                }
                resultCount++;
                throw new Error("found multiple results for '" + propName + "'='" + propValue + "', expected to find one");
            }
        }
        if (resultCount === 1) {
            return result;
        }
        return null;
    }
    Arrays.firstProp = firstProp;
    /** Get a property from each object in an array of objects
     * @param ary the array of objects
     * @param propName the name of the property to get
     * @param distinct optional boolean which indicates whether unique results only should be returned
     * @returns an array of the specified property from each object in 'ary'
     */
    function pluck(ary, propName, distinct) {
        if (ary == null || propName == null) {
            return [];
        }
        if (!distinct) {
            var results = new Array(ary.length);
            for (var i = ary.length - 1; i > -1; i--) {
                results[i] = ary[i][propName];
            }
            return results;
        }
        else {
            var results = [];
            for (var i = 0, size = ary.length; i < size; i++) {
                var value = ary[i][propName];
                if (results.indexOf(value) < 0) {
                    results.push(value);
                }
            }
            return results;
        }
    }
    Arrays.pluck = pluck;
    /** Search for the index of an object with a specified property in an array.
     * For example: Arrays.indexOfPropValue([ {name: "billy", value: 12}, {name: "sam", value: 12} ], "value", 12)
     * returns: 0
     * because the first object with the property "value" with a value of 12 was at index 0
     *
     * @param ary the array to search
     * @param propName the name of the property to search for on each object
     * @param propValue the property value to compare
     * @param offset optional, 'ary' offset at which to start search, supports negative offset same as 'Array<T>.indexOf(T, number)'
     * @returns the array index of an object with a matching property, -1 if no matching object was found
     */
    function indexOfProp(ary, propName, propValue, offset) {
        if (ary == null || propName == null || propValue === undefined) {
            return -1;
        }
        for (var size = ary.length, i = offset < 0 ? (size + offset > 0 ? size + offset : 0) : (offset || 0); i < size; i++) {
            if (ary[i][propName] === propValue) {
                return i;
            }
        }
        return -1;
    }
    Arrays.indexOfProp = indexOfProp;
    /** Search for the last index of an object with a specified property in an array
     * For example: Arrays.lastIndexOfPropValue([ {text: "john's bid", value: 12}, {text: "test bid", value: 12} ], "value", 12)
     * returns: 1
     * because the last object with the property "value" with a value of 12 was at index 1
     *
     * @param ary the array to search
     * @param propName the name of the property to search for on each object
     * @param propValue the property value to compare
     * @returns the array index of an object with a matching property, -1 if no matching object was found
     */
    function lastIndexOfProp(ary, propName, propValue) {
        if (ary == null || propName == null || propValue === undefined) {
            return -1;
        }
        for (var i = ary.length - 1; i > -1; i--) {
            if (ary[i][propName] === propValue) {
                return i;
            }
        }
        return -1;
    }
    Arrays.lastIndexOfProp = lastIndexOfProp;
    /** Check if two arrays are equal, element by element
     * For example: Arrays.equal(["A", 23, true], ["A", 23, true])
     * returns: true
     * Or example: Arrays.equal(["A", 23, true], ["A", 13])
     * returns: false
     *
     * @param ary1 the first array to compare
     * @param ary2 the second array to compare
     */
    function equal(ary1, ary2) {
        if (ary1 == null || ary2 == null || ary1.length !== ary2.length) {
            return false;
        }
        for (var i = 0, size = ary1.length; i < size; i++) {
            if (ary1[i] !== ary2[i]) {
                return false;
            }
        }
        return true;
    }
    Arrays.equal = equal;
    /** Check whether two arrays are equal, ignoring the order of the elements in each array.
     * elements are compared using strict (i.e. '===') equality.
     * For example: Arrays.looseEqual([26, "Alpha", 5], [5, 26, "Alpha"])
     * returns: true
     * Or example: Arrays.looseEqual([34, "A", "QA"], [7, 34, "A"])
     * returns: false
     *
     * @param ary1 the first array to compare
     * @param ary2 the second array to compare
     * @returns true if both arrays contain the same elements in any order, or if both arrays are null.
     * False if one or more elements differ between the two arrays
     */
    function looseEqual(ary1, ary2) {
        if (ary1 == null || ary2 == null || !Array.isArray(ary1) || !Array.isArray(ary2)) {
            if (ary1 == null && ary2 == null) {
                return true;
            }
            if ((ary1 != null && !Array.isArray(ary1)) || (ary2 != null && !Array.isArray(ary2)) || ary1 === undefined || ary2 === undefined) {
                throw new Error("incorrect usage ([" + ary1 + "], [" + ary2 + "]), " + "expected (Array ary1, Array ary2)");
            }
            if (ary1 == null || ary2 == null) {
                return false;
            }
        }
        if (ary1.length !== ary2.length) {
            return false;
        }
        var matchingCount = 0;
        for (var i = ary1.length - 1; i > -1; i--) {
            if (ary2.indexOf(ary1[i]) === -1) {
                return false;
            }
            matchingCount++;
        }
        return matchingCount == ary2.length;
    }
    Arrays.looseEqual = looseEqual;
    /** Transforms the elements of an array into a new array
     * For example: Arrays.map([1, 2, 3, 4], (value) => value % 3)
     * returns: [1, 2, 0, 1]
     *
     * @param ary the array to map
     * @returns a new array with each index containing the result of passing the original 'ary' element at that index through the 'mapFunc', or an empty array if the 'ary' is null
     */
    function map(ary, mapFunc) {
        if (ary == null) {
            return [];
        }
        var res = [];
        for (var i = 0, size = ary.length; i < size; i++) {
            res.push(mapFunc(ary[i], i, ary));
        }
        return res;
    }
    Arrays.map = map;
    /** Maps and filters an array in one operation by passing a two field object to the map-filter
     * function as a destination 'out' parameter like C#'s 'out' parameters
     * For example: Arrays.mapFilter([1, 2, 3, 4, 5, 6, 7], function (value, dstOut) { dstOut.isValid = (value % 3 !== 0); })
     * returns: [1, 2, 4, 5, 7]
     * Or example: Arrays.mapFilter(['A', 'B', 'C', 'D', 'C', 'A', 'B'], function (value, dstOut) { dstOut.isValid = (value !== 'D'); dstOut.value = value.toLowerCase(); })
     * returns: ['a', 'b', 'c', 'c', 'a', 'b']
     *
     * @param ary the array AND filter to map
     * @param mapFilterFunc since JS and TS don't have 'out' parameters
     * this function accepts a value and sets 'dstOut.isValid' true if the value is accepted, false if it is filtered out,
     * and stores the mapped result for valid values in 'dstOut.value'.
     * NOTE: if 'dstOut.value' is left null, the input 'value' is stored in the returned array
     * @returns an array of filtered and mapped result values
     */
    function mapFilter(ary, mapFilterFunc) {
        if (ary == null) {
            return [];
        }
        if (typeof mapFilterFunc !== "function") {
            throw new Error("incorrect parameter 'mapFilterFunc', must be a 'function(value, dstOut: { value; isValid }): void'");
        }
        var results = [];
        var nil = {};
        var dstOut = { value: nil, isValid: false };
        for (var i = 0, size = ary.length; i < size; i++) {
            dstOut.isValid = false;
            dstOut.value = nil;
            var inputVal = ary[i];
            mapFilterFunc(inputVal, dstOut);
            if (dstOut.isValid === true) {
                results.push(dstOut.value !== nil ? dstOut.value : inputVal);
            }
        }
        return results;
    }
    Arrays.mapFilter = mapFilter;
    /** Like #mapFilter() except null return values are filtered out instead of using an two parameter 'out' style object with an 'isValid' flag
     * @param the array of values to map-filter
     * @param mapFunc the Array#map() style function to transform input values,
     * null returned values are not stored in the returned array, allowing the function to filter
     * @returns an array of non-null mapped result values
     */
    function mapFilterNotNull(ary, mapFunc) {
        if (ary == null) {
            return [];
        }
        if (typeof mapFunc !== "function") {
            throw new Error("incorrect parameter 'mapFilterFunc', must be a 'function(value): Object'");
        }
        var results = [];
        for (var i = 0, size = ary.length; i < size; i++) {
            var res = mapFunc(ary[i], i, ary);
            if (res != null) {
                results.push(res);
            }
        }
        return results;
    }
    Arrays.mapFilterNotNull = mapFilterNotNull;
    function removeAll(ary, toRemove, fastRemove) {
        if (ary == null || toRemove == null) {
            return ary;
        }
        var idx;
        if (fastRemove) {
            // remove all matches by swapping them to the end of the array and shrinking the array
            for (var i = 0, size = toRemove.length; i < size; i++) {
                if ((idx = ary.indexOf(toRemove[i])) > -1) {
                    Arrays.fastRemoveIndex(ary, idx);
                }
            }
        }
        else {
            // find the indices to remove
            var indicesToSkip = [];
            for (var i = 0, size = toRemove.length; i < size; i++) {
                if ((idx = ary.indexOf(toRemove[i])) > -1) {
                    indicesToSkip.push(idx);
                }
            }
            // rebuild the array without the items to remove
            if (indicesToSkip.length > 0) {
                var newI = 0;
                var nextSkipIndexI = 0;
                var nextSkipIndex = indicesToSkip[nextSkipIndexI];
                for (var i = 0, size = ary.length; i < size; i++) {
                    if (i === nextSkipIndex) {
                        nextSkipIndexI++;
                        nextSkipIndex = indicesToSkip[nextSkipIndexI];
                    }
                    else {
                        ary[newI] = ary[i];
                        newI++;
                    }
                }
                ary.length = ary.length - indicesToSkip.length;
            }
        }
        return ary;
    }
    Arrays.removeAll = removeAll;
    /** Remove the first instance of a matching value from an array
     * @returns the removed index or -1 if the value could not be found
     */
    function removeValue(ary, value) {
        var idx = ary.indexOf(value);
        if (idx > -1) {
            removeIndex(ary, idx);
        }
        return idx;
    }
    Arrays.removeValue = removeValue;
    function removeIndex(ary, index) {
        if (ary == null) {
            return null;
        }
        var size = ary.length;
        if (size < 1 || index < 0 || index >= size) {
            return ary;
        }
        for (var i = index + 1; i < size; i++) {
            ary[i - 1] = ary[i];
        }
        ary[size - 1] = null;
        ary.length = size - 1;
        return ary;
    }
    Arrays.removeIndex = removeIndex;
    /** Set a property on every object in an array.
     * Useful for clearing a specific property to false or null.
     * @param ary the array of objects
     * @param propName the name of the property to set
     * @param propValue the value to assigned to each object's 'propName' property
     */
    function setAllProp(ary, propName, propValue) {
        if (ary == null || propName == null) {
            return;
        }
        for (var i = ary.length - 1; i > -1; i--) {
            ary[i][propName] = propValue;
        }
    }
    Arrays.setAllProp = setAllProp;
    /**
     * @returns the input array, sorted in numeric order (ascending by default, with second parameter flag to sort descending)
     */
    function sortNumeric(ary, descending) {
        if (descending === void 0) { descending = false; }
        if (descending === false) {
            ary.sort(function (a, b) { return a - b; });
        }
        else {
            ary.sort(function (a, b) { return b - a; });
        }
        return ary;
    }
    Arrays.sortNumeric = sortNumeric;
    /** Create an array containing the contents of two arrays.
     * For example: Arrays.spliceArray([0, 1, 1, 5], [10, 15, 20], 2, 1)
     * returns: [0, 1, 10, 15, 20, 5]
     *
     * @param origAry the initial array to copy
     * @param insertAry the array to insert into 'origAry'
     * @param index the 'origAry' index at which to insert the elements from 'insertAry'
     * @param deleteCount optional (default: 0) the number of elements to not copy from 'origAry' starting at 'index'
     * @returns the 'origAry' or a new array containing the contents of 'origAry' and 'insertAry'
     */
    function splice(origAry, insertAry, index, deleteCount, copyToNewAry) {
        if (deleteCount === void 0) { deleteCount = 0; }
        if (origAry == null) {
            if (insertAry == null) {
                return [];
            }
            else {
                return insertAry.slice(0);
            }
        }
        if ((origAry != null && !Array.isArray(origAry)) || (insertAry != null && !Array.isArray(insertAry))) {
            throw new Error("incorrect usage ([" + origAry + "], [" + insertAry + "], " + index + ", " + (deleteCount || 0) + "), " + "expected (Array, Array, Integer[, Integer])");
        }
        if (deleteCount === 0 && (insertAry == null || insertAry.length === 0)) {
            return (copyToNewAry ? origAry.slice() : origAry);
        }
        var tmp;
        // add to the end of the array
        if (index === origAry.length && deleteCount === 0) {
            tmp = (copyToNewAry ? origAry.slice() : origAry);
            if (insertAry != null && insertAry.length > 0) {
                Array.prototype.push.apply(tmp, insertAry);
            }
        }
        else if (index === 0 && deleteCount === 0) {
            tmp = (copyToNewAry ? origAry.slice() : origAry);
            if (insertAry != null && insertAry.length > 0) {
                Array.prototype.unshift.apply(tmp, insertAry);
            }
        }
        else {
            // copy up to the index to insert, then insert the array, and copying the remaining portion
            tmp = origAry.slice(0, index);
            if (insertAry != null && insertAry.length > 0) {
                Array.prototype.push.apply(tmp, insertAry);
            }
            for (var i = index + deleteCount, size = origAry.length; i < size; i++) {
                tmp.push(origAry[i]);
            }
        }
        return tmp;
    }
    Arrays.splice = splice;
    /** Swap two elements in an array
     * For example: Arrays.swap(["A", "B", "C", "D"], 1, 2)
     * returns: ["A", "C", "B", "D"]
     *
     * @param ary the array of elements
     * @param i1 the first index of the two indexes to swap
     * @param i2 the second index of the two indexes to swap
     */
    function swap(ary, i1, i2) {
        var tmp = ary[i2];
        ary[i2] = ary[i1];
        ary[i1] = tmp;
        return ary;
    }
    Arrays.swap = swap;
    function toMap(ary, prop) {
        if (ary == null) {
            return {};
        }
        return Array.prototype.reduce.call(ary, function (map, itm) {
            map[itm[prop]] = itm;
            return map;
        }, {});
    }
    Arrays.toMap = toMap;
    /** Return elements that exist in two arrays.
     * For example: Arrays.union([1, 2, 3, 4, 5, "A"], [1, 2, 4, "A"])
     * returns: [1, 2, 4, "A"]
     *
     * @param ary1 the first array
     * @param ary2 the second array
     * @returns an array of shared elements between 'ary1' and 'ary2'
     */
    function union(ary1, ary2) {
        if (ary1 == null || ary2 == null) {
            if (ary1 == null && ary2 != null) {
                return ary2.slice();
            }
            else if (ary1 != null && ary2 == null) {
                return ary1.slice();
            }
            else {
                return [];
            }
        }
        var results = [];
        for (var i = 0, size = ary1.length; i < size; i++) {
            var idx = ary2.indexOf(ary1[i]);
            if (idx > -1) {
                results.push(ary1[i]);
            }
        }
        return results;
    }
    Arrays.union = union;
    /** Find the maximum value in an array of numbers
     * @param ary the array of numbers to search
     */
    function max(ary) {
        var max = Number.NEGATIVE_INFINITY;
        for (var i = 0, size = ary.length; i < size; i++) {
            max = ary[i] > max ? ary[i] : max;
        }
        return max;
    }
    Arrays.max = max;
    /** Find the maximum value in an array of numbers
     * @param ary the array of numbers to search
     */
    function maxValueIndex(ary) {
        var max = Number.NEGATIVE_INFINITY;
        var maxI = -1;
        for (var i = 0, size = ary.length; i < size; i++) {
            if (ary[i] > max) {
                max = ary[i];
                maxI = i;
            }
        }
        return maxI;
    }
    Arrays.maxValueIndex = maxValueIndex;
    /** Find the minimum value in an array of numbers
     * @param ary the array of numbers to search
     */
    function min(ary) {
        var min = Number.POSITIVE_INFINITY;
        for (var i = 0, size = ary.length; i < size; i++) {
            min = ary[i] < min ? ary[i] : min;
        }
        return min;
    }
    Arrays.min = min;
    /** Find the minimum value in an array of numbers
     * @param ary the array of numbers to search
     */
    function minValueIndex(ary) {
        var min = Number.POSITIVE_INFINITY;
        var minI = -1;
        for (var i = 0, size = ary.length; i < size; i++) {
            if (ary[i] < min) {
                min = ary[i];
                minI = i;
            }
        }
        return minI;
    }
    Arrays.minValueIndex = minValueIndex;
    /** Sum the values of an array
     * @param ary an array of numeric convertable values to sum; null, infinite, and NaN values in the array are treated as zero.
     * If the array is null, 0 is returned.
     * @returns the sum of the values in 'ary'
     */
    function sum(ary, infinityToZero) {
        if (ary == null) {
            return 0;
        }
        var sum = 0;
        for (var i = ary.length - 1; i > -1; i--) {
            var val = ary[i];
            val = (val == null || isNaN(val) || (infinityToZero && (val === Infinity || val === Number.NEGATIVE_INFINITY || val === Number.POSITIVE_INFINITY))) ? 0 : val;
            sum += val;
        }
        return sum;
    }
    Arrays.sum = sum;
})(Arrays || (Arrays = {}));
module.exports = Arrays;

},{}],2:[function(require,module,exports){
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

},{}],3:[function(require,module,exports){
"use strict";
var Arrays = require("ts-mortar/utils/Arrays");
var DbUtil = require("./DbUtil");
/* IndexedDbPersister class which implements 'DataPersister' for saving data to IndexedDB for long-term browser data storage.
 * Exports 'IndexedDbSpi' interface which has two methods: getTables() and executeQueries(), which is the link between this 'IndexedDbPersister' class and the underlying IndexedDB database.
 * @author TeamworkGuy2
 */
var IndexedDbPersister = /** @class */ (function () {
    /** Create a DataPersister based on an IndexedDB instance and some additional functions to control the behavior of this persister.
     * @param persistenceInterface the underlying database to persist to
     * @param trace the object with functions for logging debug messages and errors
     * @param getDataCollections returns a list of data collections that contain the data to persist/restore to
     * @param addCollection when restoring a database, call this function with each table name found and restored documents
     * @param saveItemTransformation optional conversion function to pass items from 'getDataCollections()' through before persisting them
     * @param restoreItemTransformation optional conversion function to pass items through after restoring them and before storing them in 'getDataCollections()'
     * @param storageFailureCallback callback for handling/logging storage errors
     * @param tablesToNotClear optional array of collection names to not clear when 'clearPersistentDb()' is called
     * @param tablesToNotLoad optional array of collection names to not load when 'restore()' is called
     */
    function IndexedDbPersister(persistenceInterface, trace, getDataCollections, addCollection, saveItemTransformation, restoreItemTransformation, storageFailureCallback, tablesToNotClear, tablesToNotLoad) {
        this.tablesToNotClear = [];
        this.tablesToNotLoad = [];
        this.persistenceInterface = persistenceInterface;
        this.logger = trace;
        this.itemSaveConverter = saveItemTransformation;
        this.itemLoadConverter = restoreItemTransformation;
        this.getDataCollections = getDataCollections;
        this.addCollection = addCollection;
        this.storageFailureCallback = storageFailureCallback;
        this.tablesToNotClear = tablesToNotClear || [];
        this.tablesToNotLoad = tablesToNotLoad || [];
    }
    /** Get a list of collection names in this data persister
     */
    IndexedDbPersister.prototype.getCollectionNames = function () {
        return this.persistenceInterface.getTables();
    };
    /** Save this in-memory database to some form of persistent storage
     * Removes tables from store that don't exist in in-memory db
     */
    IndexedDbPersister.prototype.persist = function (defaultOptions, getCollectionOptions) {
        var that = this;
        var colls = that.getDataCollections();
        var persistCount = 0;
        return this.persistenceInterface.getTables().then(function (collNames) {
            var tableAdds = [];
            var tableDels = [];
            var tableInserts = [];
            colls.forEach(function (coll) {
                var opts = DbUtil.getOptionsOrDefault(getCollectionOptions != null ? getCollectionOptions(coll.name) : null, defaultOptions);
                var exists = collNames.indexOf(coll.name) !== -1;
                var keyCol = opts.keyColumn != null ? (typeof opts.keyColumn === "string" ? opts.keyColumn : opts.keyColumn.name) : null;
                var autoIncrement = opts.keyAutoGenerate;
                if (opts.deleteIfExists && exists) {
                    tableDels.push({ name: coll.name });
                    tableAdds.push({ name: coll.name, keyPath: keyCol, autoIncrement: autoIncrement });
                }
                if (!exists) {
                    tableAdds.push({ name: coll.name, keyPath: keyCol, autoIncrement: autoIncrement });
                }
                if (coll.dirty) {
                    persistCount++;
                    if (coll.data.length > 0) {
                        var collData = that.prepDataForSave(coll.data, opts.maxObjectsPerChunk, opts.groupByKey, opts.keyGetter);
                        tableInserts.push({ name: coll.name, clear: exists, records: collData });
                    }
                    else {
                        tableInserts.push({ name: coll.name, clear: exists });
                    }
                }
            });
            return that.persistenceInterface.modifyDatabase(tableDels, tableAdds, tableInserts);
        }).then(function (rs) {
            var persistRes = {
                collections: {}
            };
            rs.inserts.forEach(function (insert) {
                // reset collection 'dirty' flag after data successfully saved
                var coll = colls.find(function (x) { return x.name === insert.name; });
                if (coll != null) {
                    coll.dirty = false;
                }
                persistRes.collections[insert.name] = {
                    size: insert.added,
                    dataSizeBytes: null
                };
            });
            return persistRes;
        });
    };
    /** Restore in-memory database from persistent store
     * All in memory tables are dropped and re-added
     */
    IndexedDbPersister.prototype.restore = function (defaultOptions, getCollectionOptions) {
        var that = this;
        var restoreRes = {
            collections: {}
        };
        return this.persistenceInterface.getTables().then(function (tables) {
            var tablesToLoad = tables.filter(function (tbl) { return that.tablesToNotLoad.indexOf(tbl) === -1; }).map(function (tbl) { return ({ name: tbl }); });
            return that.getCollectionsRecords(tablesToLoad);
        }).then(function (results) {
            results.forEach(function (result) {
                var rows = result.records;
                var docs = [];
                if (rows.length > 0) {
                    var opts = getCollectionOptions != null ? getCollectionOptions(result.name) : null;
                    var expectArrayRes = (opts == null || opts.isChunks);
                    docs = that.readRecords(result.records, expectArrayRes);
                }
                else {
                    //if (that.logger != null) that.logger.log("skip restoring table: " + tableName + " (0 items)");
                }
                restoreRes.collections[result.name] = {
                    size: docs.length,
                    dataSizeBytes: null
                };
                that.addCollection(result.name, docs);
            });
            return restoreRes;
        }, function (err) {
            throw err;
        });
    };
    /** Get all data from a specific collection
     */
    IndexedDbPersister.prototype.getCollectionRecords = function (collectionName, options) {
        return this.getCollectionsRecords([{ name: collectionName, options: options }]).then(function (r) { return r[0].records; });
    };
    IndexedDbPersister.prototype.getCollectionsRecords = function (collections) {
        var collectionNames = Arrays.pluck(collections, "name");
        var xact = this.persistenceInterface.db.transaction(collectionNames, "readonly");
        var recordsXacts = collections.map(function (coll) { return ({ name: coll.name, getAll: xact.objectStore(coll.name).getAll() }); });
        var dfd = this.persistenceInterface.util.defer();
        xact.oncomplete = function onIdbSuccess(evt) {
            var notDoneXacts = recordsXacts.filter(function (x) { return x.getAll.readyState !== "done"; });
            if (notDoneXacts.length > 0) {
                throw new Error(notDoneXacts.length + " transactions are not done in 'oncomplete' callback");
            }
            var results = recordsXacts.map(function (x) { return ({ name: x.name, records: x.getAll.result }); });
            dfd.resolve(results);
        };
        function onIdbError(evt) {
            dfd.reject(xact.error);
        }
        xact.onerror = onIdbError;
        xact.onabort = onIdbError;
        return dfd.promise;
    };
    /** Add data to a specific collection
     */
    IndexedDbPersister.prototype.addCollectionRecords = function (collectionName, options, records, removeExisting) {
        var data = this.prepDataForSave(records, options.maxObjectsPerChunk, options.groupByKey, options.keyGetter);
        return this.persistenceInterface.insertMultiple([{
                name: collectionName,
                clear: removeExisting,
                records: data
            }]).then(function (rs) { return ({ size: rs.inserts[0].added, dataSizeBytes: null }); });
    };
    /** Remove all data from the specificed collections
     */
    IndexedDbPersister.prototype.clearCollections = function (collectionNames) {
        var clearColls = collectionNames.map(function (collName) { return ({ name: collName, clear: true }); });
        return this.persistenceInterface.insertMultiple(clearColls);
    };
    /** Delete all data related this database from persistent storage
     */
    IndexedDbPersister.prototype.clearPersistentDb = function () {
        var _this = this;
        return this.persistenceInterface.getTables().then(function (tables) {
            var delColls = tables
                .filter(function (tbl) { return _this.tablesToNotClear.indexOf(tbl) === -1; })
                .map(function (tbl) { return ({ name: tbl }); });
            return _this.persistenceInterface.modifyDatabase(delColls, null, null);
        });
    };
    IndexedDbPersister.prototype.readRecords = function (rows, expectArrayRes) {
        var convertFunc = this.itemLoadConverter;
        var docs = [];
        for (var i = 0, size = rows.length; i < size; i++) {
            var dataBlob = rows[i];
            var resChunks = [];
            if (convertFunc != null) {
                if (expectArrayRes && Array.isArray(dataBlob)) {
                    for (var j = 0, sizeJ = dataBlob.length; j < sizeJ; j++) {
                        resChunks.push(convertFunc(dataBlob[j]));
                    }
                }
                else {
                    resChunks.push(convertFunc(dataBlob));
                }
            }
            else {
                if (expectArrayRes && Array.isArray(dataBlob)) {
                    resChunks = dataBlob;
                }
                else {
                    resChunks.push(dataBlob);
                }
            }
            Array.prototype.push.apply(docs, resChunks);
        }
        return docs;
    };
    IndexedDbPersister.prototype.prepDataForSave = function (items, chunkSize, groupByKey, keyGetter) {
        var resItems = items;
        if (this.itemSaveConverter != null) {
            var convertFunc = this.itemSaveConverter;
            resItems = [];
            for (var j = 0, sizeJ = items.length; j < sizeJ; j++) {
                resItems.push(convertFunc(items[j]));
            }
        }
        var data = [];
        // records by chunks
        if (chunkSize > 0) {
            for (var i = 0, size = resItems.length; i < size; i += chunkSize) {
                data.push(resItems.slice(i, i + chunkSize > size ? size : i + chunkSize));
            }
        }
        // records by group-by
        else if (groupByKey != null && keyGetter != null) {
            var groups;
            if (typeof keyGetter === "string") {
                groups = resItems.reduce(function (grps, rec) {
                    var key = rec[keyGetter];
                    var grp = grps[key] || (grps[key] = []);
                    grp.push(rec);
                    return grps;
                }, {});
            }
            else {
                groups = resItems.reduce(function (grps, rec) {
                    var key = keyGetter(rec);
                    var grp = grps[key] || (grps[key] = []);
                    grp.push(rec);
                    return grps;
                }, {});
            }
            data = Object.keys(groups).map(function (k) { return groups[k]; });
        }
        // records as-is from collection.data array
        else {
            Array.prototype.push.apply(data, resItems);
        }
        return data;
    };
    return IndexedDbPersister;
}());
module.exports = IndexedDbPersister;

},{"./DbUtil":2,"ts-mortar/utils/Arrays":1}],4:[function(require,module,exports){
"use strict";
var DbUtil = require("./DbUtil");
var IndexedDbSpi = /** @class */ (function () {
    function IndexedDbSpi(db, util) {
        this.db = db;
        this.util = util;
    }
    IndexedDbSpi.prototype.getDatabase = function () {
        return this.db;
    };
    IndexedDbSpi.prototype.getTables = function () {
        var names = [];
        Array.prototype.push.apply(names, this.db.objectStoreNames);
        var dfd = this.util.defer();
        dfd.resolve(names);
        return dfd.promise;
    };
    IndexedDbSpi.prototype.insertMultiple = function (collectionInserts) {
        var res = {
            inserts: [],
            insertErrors: []
        };
        return IndexedDbSpi.inserts(this.db, this.util, collectionInserts, res);
    };
    /** All-in-one function to remove IndexedDB stores, add new stores, and insert records into stores.
     * This function handles bumping the DB version to trigger an 'onupgrade' callback to add and remove stores.
     * @param tableDels optional list of stores to remove from the DB, these run first
     * @param tableAdds optional list of stores to add to the DB, these run second
     * @param tableInserts optional list of data insertions to run against the DB, these run third (after table deletes/creates)
     */
    IndexedDbSpi.prototype.modifyDatabase = function (tableDels, tableAdds, tableInserts) {
        var inst = this;
        var name = this.db.name;
        var version = this.db.version;
        this.db.close();
        var res = {
            createdStores: [],
            createErrors: [],
            deletedStores: [],
            deleteErrors: [],
            inserts: [],
            insertErrors: []
        };
        var hasSchemaChanges = (tableAdds != null && tableAdds.length > 0) || (tableDels != null && tableDels.length > 0);
        // upgrade the DB version to trigger an 'onupgradeneeded' call so we can create and/or delete object stores
        return IndexedDbSpi.openDatabase(this.util, name, hasSchemaChanges ? version + 1 : version, function versionUpgrade(evt) {
            // Database modifications must be performed within 'onupgrade' callback
            var db = this.result;
            inst.db = db;
            // delete stores (first so that create stores can re-create stores)
            (tableDels || []).forEach(function (tbl) {
                try {
                    db.deleteObjectStore(tbl.name);
                    res.deletedStores.push(tbl);
                }
                catch (err) {
                    res.deleteErrors.push({ name: tbl.name, error: err });
                }
            });
            // create stores
            (tableAdds || []).forEach(function (tbl) {
                try {
                    var createRes = db.createObjectStore(tbl.name, tbl);
                    res.createdStores.push(createRes);
                }
                catch (err) {
                    res.createErrors.push({ name: tbl.name, error: err });
                }
            });
        }).then(function () { return IndexedDbSpi.inserts(inst.db, inst.util, tableInserts, res); });
    };
    IndexedDbSpi.prototype.destroyDatabase = function () {
        var dfd = this.util.defer();
        var dbDelReq = self.indexedDB.deleteDatabase(this.db.name);
        wrapRequest(dbDelReq, function destroyDbSuccess(evt) {
            dfd.resolve(null);
        }, function destroyDbError(evt) {
            dfd.reject(dbDelReq.error);
        });
        return dfd.promise;
    };
    IndexedDbSpi.addOrPut = function (dbColl, tbl) {
        if (tbl.records == null) {
            return;
        }
        // TODO for now just calling put()/add() in a loop and not waiting on the resulting request to complete before inserting the next
        if (tbl.overwrite) {
            if (tbl.keyGetter != null) {
                for (var i = 0, size = tbl.records.length; i < size; i++) {
                    dbColl.put(tbl.records[i], tbl.keyGetter(tbl.records[i]));
                }
            }
            else {
                for (var i = 0, size = tbl.records.length; i < size; i++) {
                    dbColl.put(tbl.records[i]);
                }
            }
        }
        else {
            if (tbl.keyGetter != null) {
                for (var i = 0, size = tbl.records.length; i < size; i++) {
                    dbColl.add(tbl.records[i], tbl.keyGetter(tbl.records[i]));
                }
            }
            else {
                for (var i = 0, size = tbl.records.length; i < size; i++) {
                    dbColl.add(tbl.records[i]);
                }
            }
        }
    };
    IndexedDbSpi.inserts = function (db, util, tableInserts, res) {
        if (tableInserts == null) {
            return res;
        }
        var pInserts = util.defer();
        var insertCount = tableInserts.length;
        var insertsDone = 0;
        // insert records into stores
        tableInserts.forEach(function (tbl) {
            var insertErrors = [];
            var xact = db.transaction(tbl.name, "readwrite");
            var dbColl = xact.objectStore(tbl.name);
            var clearedCount = 0;
            if (tbl.clear) {
                // get record count and clear the store
                var countReq = dbColl.count();
                countReq.onsuccess = function onIdbSuccess(evt) {
                    var clearReq = dbColl.clear();
                    clearReq.onsuccess = function onIdbSuccess(evt) {
                        clearedCount = countReq.result;
                        // add new records
                        IndexedDbSpi.addOrPut(dbColl, tbl);
                    };
                    clearReq.onerror = function onIdbSuccess(evt) {
                        insertErrors.push(clearReq.error);
                        xact.abort();
                    };
                };
                countReq.onerror = function onIdbSuccess(evt) {
                    insertErrors.push(countReq.error);
                    xact.abort();
                };
            }
            else {
                // add new records
                IndexedDbSpi.addOrPut(dbColl, tbl);
            }
            xact.oncomplete = function onIdbSuccess(evt) {
                res.inserts.push({ name: tbl.name, added: tbl.records != null ? tbl.records.length : 0, removed: clearedCount });
                insertsDone++;
                if (insertsDone >= insertCount) {
                    pInserts.resolve(res);
                }
            };
            function onIdbError(evt) {
                insertErrors.push(xact.error);
                res.insertErrors.push({ name: tbl.name, errors: insertErrors });
                insertsDone++;
                pInserts.reject(xact.error);
            }
            xact.onerror = onIdbError;
            xact.onabort = onIdbError;
        });
        return pInserts.promise;
    };
    IndexedDbSpi.openDatabase = function (util, name, version, onupgradeneeded) {
        util.log(util.DEBUG, "openDatabase", name, version);
        var dfd = util.defer();
        var pUpgrade;
        try {
            if (typeof self === "undefined" || !self.indexedDB) {
                util.rejectError(dfd, "IndexedDB not implemented");
            }
            else {
                var dbOpenReq = (version != null ? self.indexedDB.open(name, version) : self.indexedDB.open(name));
                wrapRequest(dbOpenReq, function openDbSuccess(evt) {
                    if (pUpgrade != null) {
                        pUpgrade.then(function (r) { return dfd.resolve(dbOpenReq.result); }, function (err) { return util.rejectError(dfd, "onupgradeneeded handler failed", { exception: err }); });
                    }
                    else {
                        dfd.resolve(dbOpenReq.result);
                    }
                }, function openDbError(evt) {
                    util.rejectError(dfd, "Failed to open database", { exception: dbOpenReq.error });
                }, function dbUpgradeNeeded(evt) {
                    // triggered when opening a new DB or an existing DB with a higher version number than last time it was opened
                    util.log(util.DEBUG, "upgradeNeeded", name, version);
                    if (onupgradeneeded != null) {
                        var onUpgradeRes = onupgradeneeded.call(this, evt);
                        if (util.isPromise(onUpgradeRes)) {
                            pUpgrade = onUpgradeRes;
                        }
                    }
                });
            }
        }
        catch (ex) {
            util.rejectError(dfd, "Failed to open database " + name, { exception: ex });
        }
        return dfd.promise;
    };
    IndexedDbSpi.newIndexedDb = function (name, version, utilSettings) {
        var util = new DbUtil("IndexedDB", "[object IDBDatabase]", utilSettings);
        // Create IndexedDB wrapper from native Database or by opening 'name' DB
        var pOpen;
        if (util.isDatabase(name)) {
            var dfd = util.defer();
            dfd.resolve(name);
            pOpen = dfd.promise;
        }
        else {
            pOpen = IndexedDbSpi.openDatabase(util, name, version);
        }
        return pOpen.then(function (dbInst) { return new IndexedDbSpi(dbInst, util); });
    };
    return IndexedDbSpi;
}());
function isOpenDbRequest(dbReq) {
    return "onupgradeneeded" in dbReq;
}
function wrapRequest(dbReq, onsuccess, onerror, onupgradeneeded) {
    dbReq.onsuccess = onsuccess;
    dbReq.onerror = onerror;
    if (isOpenDbRequest(dbReq)) {
        if (onupgradeneeded == null) {
            throw new Error("must provide an onupgradeneeded handler for open DB requests");
        }
        dbReq.onupgradeneeded = onupgradeneeded;
        dbReq.onblocked = onerror;
    }
    return dbReq;
}
module.exports = IndexedDbSpi;

},{"./DbUtil":2}],5:[function(require,module,exports){
"use strict";
var Arrays = require("ts-mortar/utils/Arrays");
var DbUtil = require("./DbUtil");
/** WebSqlPersister class which implements 'DataPersister' for saving data to WebSQL for long-term browser data storage.
 * Exports 'WebSqlSpi' interface which has two methods: getTables() and executeQueries(), which is the link between this 'WebSqlPersister' class and the underlying WebSQL database.
 * @author TeamworkGuy2
 */
var WebSqlPersister = /** @class */ (function () {
    /** Create a DataPersister based on a WebSqlSpi instance and some additional functions to control the behavior of this persister.
     * @param persistenceInterface the underlying database to persist to
     * @param trace the object with functions for logging debug messages and errors
     * @param getDataCollections returns a list of data collections that contain the data to persist/restore to
     * @param addCollection when restoring a database, call this function with each table name found and restored documents
     * @param saveItemTransformation optional conversion function to pass items from 'getDataCollections()' through before persisting them
     * @param postSaveTransformKeyValueFilter optional JSON.stringify() 'replacer', second parameter, function which is called for each object stringified by calls to persist()
     * @param restoreItemTransformation optional conversion function to pass items through after restoring them and before storing them in 'getDataCollections()'
     * @param storageFailureCallback callback for handling/logging storage errors
     * @param tablesToNotClear optional array of collection names to not clear when 'clearPersistentDb()' is called
     * @param tablesToNotLoad optional array of collection names to not load when 'restore()' is called
     */
    function WebSqlPersister(persistenceInterface, trace, getDataCollections, addCollection, saveItemTransformation, postSaveTransformKeyValueFilter, restoreItemTransformation, storageFailureCallback, tablesToNotClear, tablesToNotLoad) {
        this.tablesToNotClear = [];
        this.tablesToNotLoad = [];
        this.persistenceInterface = persistenceInterface;
        this.logger = trace;
        this.itemSaveConverter = saveItemTransformation;
        this.itemKeyValueFilter = postSaveTransformKeyValueFilter;
        this.itemLoadConverter = restoreItemTransformation;
        this.getDataCollections = getDataCollections;
        this.addCollection = addCollection;
        this.storageFailureCallback = storageFailureCallback;
        this.tablesToNotClear = tablesToNotClear || [];
        this.tablesToNotLoad = tablesToNotLoad || [];
    }
    /** Persist in-memory database to disk
     * Removes tables from store that don't exist in in-memory db
     */
    WebSqlPersister.prototype.persist = function (defaultOptions, getCollectionOptions) {
        var that = this;
        var timerId = DbUtil.newTimer("persist");
        var dfd = this.persistenceInterface.util.defer();
        var persistCount = 0;
        var persistData = {
            collections: {}
        };
        function addOrUpdatePersistInfo(collName, addSize, addDataSizeBytes) {
            if (persistData.collections[collName] == null) {
                persistData.collections[collName] = {
                    size: addSize,
                    dataSizeBytes: addDataSizeBytes
                };
            }
            else {
                var collPersistInfo = persistData.collections[collName];
                collPersistInfo.size = collPersistInfo.size + addSize;
                collPersistInfo.dataSizeBytes = collPersistInfo.dataSizeBytes + addDataSizeBytes;
            }
        }
        // add new tables and remove tables that do not have collections
        this.persistenceInterface.getTables().then(function (tables) {
            var tableNames = Arrays.pluck(tables, "name");
            var promises = [];
            var colls = that.getDataCollections();
            colls.forEach(function (coll) {
                var sqls = [];
                var opts = DbUtil.getOptionsOrDefault(getCollectionOptions != null ? getCollectionOptions(coll.name) : null, defaultOptions);
                var exists = tableNames.indexOf(coll.name) !== -1;
                if (opts.deleteIfExists && exists) {
                    sqls.push({ sql: "DROP TABLE " + coll.name, args: [] });
                    sqls.push({ sql: "CREATE TABLE " + coll.name + " (" + (opts.keyColumn != null ? opts.keyColumn.name + " " + opts.keyColumn.type + ", " : "") + opts.dataColumnName + " blob)", args: [] });
                }
                if (!exists) {
                    sqls.push({ sql: "CREATE TABLE IF NOT EXISTS " + coll.name + " (" + (opts.keyColumn != null ? opts.keyColumn.name + " " + opts.keyColumn.type + ", " : "") + opts.dataColumnName + " blob)", args: [] });
                }
                if (coll.dirty) {
                    if (exists) {
                        sqls.push({ sql: "DELETE FROM " + coll.name, args: [] });
                    }
                    persistCount++;
                    // create the sql statements
                    if (coll.data.length > 0) {
                        var res = that.createInsertStatements(coll.name, coll.data, opts.keyGetter, opts.keyColumn && opts.keyColumn.name, opts.groupByKey, opts.maxObjectsPerChunk, opts.compress);
                        addOrUpdatePersistInfo(coll.name, res.itemCount, res.jsonSize);
                        sqls.push({ sql: res.sql, args: res.args });
                    }
                    coll.dirty = false;
                }
                if (sqls.length > 0) {
                    var collPromise = that.persistenceInterface.executeQueries(sqls);
                    promises.push(collPromise);
                }
            });
            return that.persistenceInterface.util.whenAll(promises);
        }).then(function (results) {
            if (persistCount > 0) {
                var timeMs = timerId.measure();
                var totalWriteSize = Object.keys(persistData.collections).reduce(function (prev, collName) { return prev + persistData.collections[collName].dataSizeBytes; }, 0);
                if (that.logger != null)
                    that.logger.log("Data saved: ", Math.floor(timeMs), "(ms), ", totalWriteSize, "(bytes), meta-info: ", persistData.collections);
            }
            dfd.resolve(persistData);
        }, function (error) {
            if (error.sqlError && error.sqlError.message && error.sqlError.message.indexOf("there was not enough remaining storage space") > -1) {
                if (that.storageFailureCallback) {
                    that.storageFailureCallback(error);
                }
            }
            dfd.reject(error);
        });
        return dfd.promise;
    };
    /** Restore in-memory database from persistent storage.
     * All in memory tables are dropped and re-added
     */
    WebSqlPersister.prototype.restore = function (defaultOptions, getCollectionOptions) {
        var that = this;
        var timerId = DbUtil.newTimer("restore");
        var defaultDecompress = (defaultOptions != null && defaultOptions.decompress) || false;
        var dfd = this.persistenceInterface.util.defer();
        var restoreRes = {
            collections: {}
        };
        var tableNames = [];
        this.persistenceInterface.getTables().then(function (tables) {
            tableNames = Arrays.pluck(tables, "name").filter(function (n) { return that.tablesToNotLoad.indexOf(n) === -1; });
            var sqls = tables.filter(function (t) { return that.tablesToNotLoad.indexOf(t.name) === -1; })
                .map(function (table) { return ({ sql: "SELECT * FROM " + table.name, args: [] }); });
            return that.persistenceInterface.executeQueries(sqls);
        }).then(function (results) {
            results.forEach(function (result, tableIndex) {
                var tableName = tableNames[tableIndex];
                var docs = [];
                var res = {
                    size: 0,
                    dataSizeBytes: 0
                };
                if (result.rows.length > 0) {
                    var opts = getCollectionOptions != null ? getCollectionOptions(tableName) : null;
                    var decompress = opts != null ? opts.decompress || defaultDecompress : defaultDecompress;
                    var dataColumnName = opts != null ? opts.dataColumnName || WebSqlPersister.defaultDataColumnName : WebSqlPersister.defaultDataColumnName;
                    // check whether the row format has our required column
                    if (result.rows.item(0)[dataColumnName]) {
                        docs = that.readRecords(result.rows, dataColumnName, decompress, opts == null || opts.isChunks, res);
                    }
                    else {
                        if (that.logger != null && that.logger.error != null)
                            that.logger.error("skip restoring table: " + tableName + " (unrecognized data format)");
                    }
                }
                else {
                    //if (that.logger != null) that.logger.log("skip restoring table: " + tableName + " (0 items)");
                }
                res.size = docs.length;
                restoreRes.collections[tableName] = res;
                that.addCollection(tableName, docs);
            });
            var timeMs = timerId.measure();
            if (that.logger != null)
                that.logger.log("Data loaded", Math.floor(timeMs), "(ms)");
            dfd.resolve(restoreRes);
        }, function (err) {
            dfd.reject(err);
        });
        return dfd.promise;
    };
    /** Get a list of collection names in this data persister
     */
    WebSqlPersister.prototype.getCollectionNames = function () {
        return this.persistenceInterface.getTables().then(function (tbls) { return tbls.map(function (t) { return t.name; }); });
    };
    /** Get all data from a specific collection
     */
    WebSqlPersister.prototype.getCollectionRecords = function (collectionName, options) {
        var that = this;
        var sqls = [{ sql: "SELECT * FROM " + collectionName, args: [] }];
        return this.persistenceInterface.executeQueries(sqls).then(function (_a) {
            var result = _a[0];
            var docs = [];
            if (result.rows.length > 0) {
                var decompress = options != null ? options.decompress || false : false;
                var dataColumnName = options != null ? options.dataColumnName || WebSqlPersister.defaultDataColumnName : WebSqlPersister.defaultDataColumnName;
                // check whether the row formats has our required column
                if (result.rows.item(0)[dataColumnName]) {
                    docs = that.readRecords(result.rows, dataColumnName, decompress, options == null || options.isChunks);
                }
                else {
                    if (that.logger != null && that.logger.error != null)
                        that.logger.error("skip restoring table: " + collectionName + " (unrecognized data format)");
                }
            }
            return docs;
        });
    };
    /** Add data to a specific collection
     */
    WebSqlPersister.prototype.addCollectionRecords = function (collectionName, options, records, removeExisting) {
        var opts = DbUtil.getOptionsOrDefault(options, { compress: false, maxObjectsPerChunk: WebSqlPersister.MAX_OBJECTS_PER_PERSIST_RECORD });
        var res = records.length > 0 ? this.createInsertStatements(collectionName, records, opts.keyGetter, opts.keyColumn && opts.keyColumn.name, opts.groupByKey, opts.maxObjectsPerChunk, opts.compress) : null;
        var sqls = [];
        if (removeExisting) {
            sqls.push({ sql: "DELETE FROM " + collectionName, args: [] });
        }
        if (records.length > 0) {
            sqls.push({ sql: res.sql, args: res.args });
        }
        return this.persistenceInterface.executeQueries(sqls).then(function (_a) {
            var result = _a[0];
            return (res != null ? { size: res.itemCount, dataSizeBytes: res.jsonSize } : { size: 0, dataSizeBytes: 0 });
        });
    };
    /** Remove all data from the specificed collections
     */
    WebSqlPersister.prototype.clearCollections = function (collectionNames) {
        var sqls = collectionNames.map(function (collName) { return ({ sql: "DELETE FROM " + collName, args: [] }); });
        return this.persistenceInterface.executeQueries(sqls).then(function (results) { return null; });
    };
    /** Delete all data related this database from persistent storage
     */
    WebSqlPersister.prototype.clearPersistentDb = function () {
        var _this = this;
        var timerId = DbUtil.newTimer("clear");
        var dfd = this.persistenceInterface.util.defer();
        this.persistenceInterface.getTables().then(function (tables) {
            var sqls = tables
                .filter(function (t) { return _this.tablesToNotClear.indexOf(t.name) === -1; })
                .map(function (table) { return ({ sql: "DROP TABLE " + table.name, args: [] }); });
            return _this.persistenceInterface.executeQueries(sqls);
        }).then(function (sqls) {
            var timeMs = timerId.measure();
            if (_this.logger != null)
                _this.logger.log("Data cleared", Math.floor(timeMs), "(ms)");
            dfd.resolve(null);
        }, function (err) {
            dfd.reject(err);
        });
        return dfd.promise;
    };
    /** Reads rows from a SqlResultSetRowList. First each row's 'dataColumnName' column is parsed via JSON.parse(), then the data is processed as follows:
     *  - if the parsed data is an array, assume it's an array of data models, if an 'itemLoadConverter' function was provided in the constructor, use it to convert each object, else return the array of objects
     *  - if the parsed data is not an array, assume it is a single data model, if an 'itemLoadConverter' function was provided in the constructor, use it to convert the object, else return the object
     * Note: because of this logic, using an array as a data model will not produce correct results since the array will be assumed to contain multiple individual data objects
     * @param rows the result set rows to process
     * @param dataColumnName the name of the column containing the model data
     * @param decompress (currently not supported) whether data strings should be decompressed or not
     * @param expectArrayRes whether data strings are expected to be array chunks with the actual data records inside
     * @param res optional stats object in which to store info about the rows read
     */
    WebSqlPersister.prototype.readRecords = function (rows, dataColumnName, decompress, expectArrayRes, res) {
        var convertFunc = this.itemLoadConverter;
        var docs = [];
        for (var i = 0, size = rows.length; i < size; i++) {
            var dataBlob = rows.item(i)[dataColumnName];
            if (res != null) {
                res.dataSizeBytes += dataBlob.length;
            }
            if (decompress) {
                //dataBlob = pako.inflate(dataBlob, { to: "string" });
            }
            // NOTE: may throw error
            var chunks = JSON.parse(dataBlob);
            var resChunks = [];
            if (convertFunc != null) {
                if (expectArrayRes && Array.isArray(chunks)) {
                    for (var j = 0, sizeJ = chunks.length; j < sizeJ; j++) {
                        resChunks.push(convertFunc(chunks[j]));
                    }
                }
                else {
                    resChunks.push(convertFunc(chunks));
                }
                chunks = null;
            }
            else {
                if (expectArrayRes && Array.isArray(chunks)) {
                    resChunks = chunks;
                }
                else {
                    resChunks.push(chunks);
                }
            }
            Array.prototype.push.apply(docs, resChunks);
        }
        return docs;
    };
    WebSqlPersister.prototype.createInsertStatements = function (collName, items, keyGetter, keyColumn, groupByKey, chunkSize, compress) {
        var sql;
        var sqlArgs = [];
        var resItems = items;
        if (this.itemSaveConverter != null) {
            var convertFunc = this.itemSaveConverter;
            resItems = [];
            for (var j = 0, sizeJ = items.length; j < sizeJ; j++) {
                resItems.push(convertFunc(items[j]));
            }
        }
        var itemCount = 0;
        var jsonSize = 0;
        // records by chunks
        if (keyGetter == null && chunkSize > 0) {
            sql = "INSERT INTO " + collName + " VALUES(?)";
            for (var i = 0, sz = resItems.length; i < sz; i += chunkSize) {
                var data = resItems.slice(i, i + chunkSize);
                var jsonData = JSON.stringify(data, this.itemKeyValueFilter);
                if (compress) {
                    //jsonData = <string>pako.deflate(jsonData, { to: "string" });
                }
                itemCount += data.length;
                jsonSize += jsonData.length;
                sqlArgs.push([jsonData]);
            }
        }
        // records by group-by
        else if (keyGetter != null && groupByKey != null) {
            sql = "INSERT INTO " + collName + (keyColumn != null ? " VALUES(?,?)" : " VALUES(?)");
            if (typeof keyGetter === "string") {
                var uniqueKeyLists = resItems.reduce(function (mp, itm) {
                    var value = itm[keyGetter];
                    var ary = (mp[value] || (mp[value] = []));
                    ary.push(itm);
                    return mp;
                }, {});
            }
            else {
                var uniqueKeyLists = resItems.reduce(function (mp, itm) {
                    var value = keyGetter(itm);
                    var ary = (mp[value] || (mp[value] = []));
                    ary.push(itm);
                    return mp;
                }, {});
            }
            for (var key in uniqueKeyLists) {
                var data = uniqueKeyLists[key];
                var jsonData = JSON.stringify(data, this.itemKeyValueFilter);
                itemCount += data.length;
                jsonSize += jsonData.length;
                sqlArgs.push(keyColumn != null ? [key, jsonData] : [jsonData]);
            }
        }
        // records by key
        else if (keyGetter != null) {
            sql = "INSERT INTO " + collName + (keyColumn != null ? " VALUES(?,?)" : " VALUES(?)");
            if (typeof keyGetter === "string") {
                for (var i = 0, sz = resItems.length; i < sz; i++) {
                    var datum = resItems[i];
                    var jsonData = JSON.stringify(datum, this.itemKeyValueFilter);
                    var keyVal = datum[keyGetter];
                    itemCount += 1;
                    jsonSize += jsonData.length;
                    sqlArgs.push(keyColumn != null ? [keyVal, jsonData] : [jsonData]);
                }
            }
            else {
                for (var i = 0, sz = resItems.length; i < sz; i++) {
                    var datum = resItems[i];
                    var jsonData = JSON.stringify(datum, this.itemKeyValueFilter);
                    var key = keyGetter(datum);
                    itemCount += 1;
                    jsonSize += jsonData.length;
                    sqlArgs.push(keyColumn != null ? [key, jsonData] : [jsonData]);
                }
            }
        }
        else {
            throw new Error("unsupported persist options combination: keyGetter=" + keyGetter + ", keyColumn=" + keyColumn + ", groupByKey=" + groupByKey + ", chunkSize=" + chunkSize);
        }
        return { sql: sql, args: sqlArgs, itemCount: itemCount, jsonSize: jsonSize };
    };
    WebSqlPersister.MAX_OBJECTS_PER_PERSIST_RECORD = 1000;
    WebSqlPersister.defaultDataColumnName = "bigString";
    return WebSqlPersister;
}());
module.exports = WebSqlPersister;

},{"./DbUtil":2,"ts-mortar/utils/Arrays":1}],6:[function(require,module,exports){
"use strict";
/// <reference types="websql" />
var DbUtil = require("./DbUtil");
/*! websql.js | MIT license | Stepan Riha | http://bitbucket.org/nonplus/websql-js
 * websql.js may be freely distributed under the MIT license.
 * converted to TypeScript at 2017-11-04 by TeamworkGuy2
 */
/** Module that wraps asynchronous WebSQL calls with deferred promises and provides SQL utility methods.
 *
 * Promises are **resolved** when asynchronous database callback is finished.
 * Promises are **rejected** with an `Error` object that may contain one or more of the following:
 *  - `message`: Describing what failed
 *  - `exception`: Exception that was thrown
 *  - `sqlError`: Error returned by WebSQL
 *  - `sql`: statement that was executing
 *
 * ## Using the API
 * Example:
 *     var wsdb = WebSqlSpi.newWebSqlDb(nameOrDbInst, _version_, _displayName_, _estimatedSize_, utilSettings);
 *     wsdb.read({ sql: "SELECT * FROM ..." }).then(function(resultSet) { ... });
 *
 * ## Public Methods ##
 * - `newWebSqlDb(nameOrDb, ...)` takes the same parameters as the `window.openDatabase` function, and used default values for unspecified parameters.
 * Returns: new a promise which resolves with the new `WebsqlDatabase` wrapper class.
 * Usage:
 *     var wsdb = WebSqlSpi.newWebSqlDb("test", 1, "Test Database", 2 * 1024 * 1024, new DbUtil(...));
 *     wsdb.execute({ sql: "INSERT INTO ...", args: [...] }).then(function(resultSet) { ... })
 */
var WebSqlSpi = /** @class */ (function () {
    function WebSqlSpi(db, util) {
        this.db = db;
        this.util = util;
        this.transaction = this.transaction.bind(this);
        this.readTransaction = this.readTransaction.bind(this);
    }
    /** Returns: promise that resolves once the database version has been changed
     * Usage:
     *     wsdb.changeVersion(1, 2, function (xact) {
     *         xact.executeSQL(...);
     *     }).then(function() {...});
     */
    WebSqlSpi.prototype.changeVersion = function (oldVersion, newVersion, xactCallback) {
        var util = this.util;
        var dfd = util.defer();
        if (!util.isDatabase(this.db)) {
            util.rejectError(dfd, "Database not specified (db='" + this.db + "')");
            return dfd.promise;
        }
        util.log(util.DEBUG, "changeVersion", oldVersion, newVersion);
        try {
            this.db.changeVersion("" + oldVersion, "" + newVersion, xactCallback, function (sqlError) {
                util.rejectError(dfd, "Failed to change version", { sqlError: sqlError });
            }, function () {
                dfd.resolve(null);
            });
        }
        catch (ex) {
            util.rejectError(dfd, "Failed changeVersion(db, '" + oldVersion + "', '" + newVersion + "')", { exception: ex });
        }
        return dfd.promise;
    };
    /** Queries the sqlite_master table for user tables
     * Returns: promise that resolves with an array of table information records
     * Usage:
     *     wsdb.getTables().then(function(tables) {
     *         for(var i = 0; i < tables.length; i++) {
     *             var name = tables[i].name;
     *             var sql = tables[i].sql;
     *             ...
     *         }
     *     });
     */
    WebSqlSpi.prototype.getTables = function () {
        var sql = "SELECT name, type, sql FROM sqlite_master " +
            "WHERE type in ('table') AND name NOT LIKE '?_?_%' ESCAPE '?'";
        return this.execSqlStatements(this.readTransaction, "read", { sql: sql }, function (rs) {
            var tables = [];
            var rows = rs.rows;
            for (var i = 0, size = rows.length; i < size; i++) {
                tables.push(rows.item(i));
            }
            return tables;
        });
    };
    /** Queries the sqlite_master for a table by name
     * Returns: promise that resolves with table info or with `undefined` if table
     * does not exist.
     * Usage:
     *     wsdb.tableExists("person").then(function (table) {
     *         alert("table " + (table ? "exists" : "does not exist"));
     *     });
     */
    WebSqlSpi.prototype.tableExists = function (name) {
        var sql = "SELECT * FROM sqlite_master WHERE name = ?";
        return this.readRow([{ sql: sql, args: [[name]] }], function (row) {
            return row || undefined;
        });
    };
    /** Drops all the tables in the database.
     * Returns: promise that resolves with this `WebsqlDatabase`
     * Usage:
     *     wsdb.destroyDatabase()
     *         .then(function (wsdb) {...});
     */
    WebSqlSpi.prototype.destroyDatabase = function () {
        return this.changeVersion(this.db.version, "", function (xact) {
            var sql = "SELECT name FROM sqlite_master " +
                "WHERE type in ('table') AND name NOT LIKE '?_?_%' ESCAPE '?'";
            xact.executeSql(sql, [], function (xact, rs) {
                var rows = rs.rows;
                for (var i = 0, size = rows.length; i < size; i++) {
                    var sql = 'DROP TABLE "' + rows.item(i).name + '"';
                    xact.executeSql(sql);
                }
            });
        });
    };
    /** Calls xactCallback(xact) from within a database transaction
     * Returns: promise that resolves with the database
     * Usage:
     *     wsdb.transaction(function (xact) {
     *         xact.executeSQL(...);
     *     }).then(function (wsdb) {...});
     *
     * More usage:
     *     var addressId;
     *     var personId;
     *
     *     function insertPerson(xact) {
     *         return xact.executeSql("INSERT INTO person ...", [...],
     *             function (xact, rs) {
     *                 personId = rs.insertId;
     *                 insertAddress(xact, personId);
     *             }
     *         )
     *     }
     *
     *     function insertAddress(xact, personId) {
     *         return wsdb.executeSql(xact, "INSERT INTO address (person, ...) VALUES (?, ...)",
     *             [personId, ...],
     *             function (xact, rs) {
     *                 addressId = rs.insertId;
     *             }
     *         )
     *     }
     *
     *     wsdb.transaction(function (xact) {
     *         insertPerson(xact);
     *     }).then(function(wsdb) {
     *         alert("Created person " + personId + " with address " + addressId);
     *     });
     */
    WebSqlSpi.prototype.transaction = function (xactCallback) {
        return this.executeTransaction("transaction", xactCallback);
    };
    /** Calls xactCallback(xact) from within a database read transaction
     * Returns: promise that resolves with the database
     * Usage:
     *     wsdb.readTransaction(function (xact) {
     *         xact.executeSQL(...);
     *     }).then(function (wsdb) {...});
     */
    WebSqlSpi.prototype.readTransaction = function (xactCallback) {
        return this.executeTransaction("readTransaction", xactCallback);
    };
    /** Call 'webSqlFunc' method on 'db'
     * Implements common behavior for 'wsdb.transaction' and 'wsdb.readTransaction'
     */
    WebSqlSpi.prototype.executeTransaction = function (webSqlFuncName, xactCallback) {
        var util = this.util;
        var dfd = util.defer();
        if (!util.isDatabase(this.db)) {
            util.rejectError(dfd, "Database not specified (db='" + this.db + "')");
            return dfd.promise;
        }
        if (this.db[webSqlFuncName] == null) {
            util.rejectError(dfd, "Database function '" + webSqlFuncName + "' does not exist");
            return dfd.promise;
        }
        try {
            this.db[webSqlFuncName](function (xact) {
                try {
                    xactCallback(xact);
                }
                catch (exception) {
                    util.rejectError(dfd, webSqlFuncName + " callback threw an exception", { exception: exception });
                }
            }, function (sqlError) {
                util.rejectError(dfd, "Failed executing " + webSqlFuncName.replace(/transaction/i, "") + " transaction", { sqlError: sqlError });
            }, function () {
                dfd.resolve(null);
            });
        }
        catch (exception) {
            util.rejectError(dfd, "Failed calling " + webSqlFuncName, { exception: exception });
        }
        return dfd.promise;
    };
    /** Method for executing a transaction with a one or more `sqlStatement`
     * with the specified `args`, calling the `rsCallback` with the result set(s).
     * The `args` and `rsCallback` are optional.
     * * Passing a _single_ `sqlStatement` string with `args` that is an _array of arrays_,
     * the statement is executed with each row in the `args`.
     * Passing an array of `{ sql, args}` objects to `sqlStatement`
     * executes the `sql` in each row with the row's `args` (or the parameter `args`).
     *
     * Returns: promise that resolves with `rsCallback` result
     * or the resultSet, if no `rsCallback` specified.  If an array of statements or arguments
     * is specified, the promise resolves with an array of results/resultSets.
     *
     * Basic Usage:
     *     wsdb.execute("DELETE FROM person")
     *         .then(function (resultSet) {...});
     *
     * Other Usage: (single `sqlStatement` with multiple sets of `args`)
     *     wsdb.execute("INSERT INTO person (first, last) VALUES (?, ?)",
     *         [
     *             ["John", "Doe"],
     *             ["Jane", "Doe"]
     *         ],
     *         // called for each row in args
     *         function (rs) {
     *             console.log("Inserted person", rs.insertId);
     *             return rs.insertId;
     *         }
     *     ).then(function (insertIds) {
     *         var personId1 = insertIds[0], personId2 = insertIds[1];
     *         ...
     *     });
     *
     * Other Usage: (multiple `sqlStatement` with multiple sets of `args`)
     *     wsdb.execute(
     *         [{
     *             sql: "UPDATE person SET (first=?, last=?) WHERE id=?",
     *             args: ["Robert", "Smith", 23]
     *         }, {
     *             sql: "UPDATE address SET (street=?, city=?, zip=?) WHERE id=?",
     *             args: ["Sesame St.", "Austin", "78758", 45]
     *         }],
     *         // called for each object in args
     *         function (rs) {
     *             console.log("Updated object: ", rs.rowsAffected);
     *             return rs.rowsAffected;
     *         }
     *     ).then(function (results) {
     *         var numPersons = results[0], numAddresses = results[1];
     *         ...
     *     });
     */
    WebSqlSpi.prototype.executeQuery = function (sqlStatement) {
        return this.execSqlStatements(this.transaction, "execute", sqlStatement, null);
    };
    WebSqlSpi.prototype.executeQueries = function (sqlStatements) {
        return this.execSqlStatements(this.transaction, "execute", sqlStatements, null);
    };
    WebSqlSpi.prototype.execute = function (sqlStatements, rsCallback) {
        return this.execSqlStatements(this.transaction, "execute", sqlStatements, rsCallback);
    };
    /** Method for executing a readTransaction with a one or more `sqlStatement`
     * with the specified `args`, calling the `rsCallback` with the result set(s).
     * The `args` and `rsCallback` are optional.
     * Passing a _single_ `sqlStatement` string with `args` that is an _array of arrays_,
     * the statement is executed with each row in the `args`.
     * Passing an array of `{ sql, args}` objects to `sqlStatement`
     * executes the `sql` in each row with the row's `args` (or the parameter `args`).
     * Returns: promise that resolves with `rsCallback` result
     * or the resultSet, if no `rsCallback` specified.  If an array of statements or arguments
     * is specified, the promise resolves with an array of results/resultSets.
     * Usage:
     *     wsdb.read("SELECT * FROM person WHERE first = ?",
     *         ["Bob"],
     *         function (rs) {
     *             var rows = rs.rows;
     *             for(var i = 0; i < rows.length; i++) {
     *                 ...
     *             }
     *             return result;
     *         }
     *     ).then(function (result) {...});
     *
     * Other Usage: (single `sqlStatement` with multiple sets of `args`)
     *     wsdb.read("SELECT * FROM person WHERE first = ?",
     *         [ ["Bob"], ["John"] ],
     *         // called for each row in args
     *         function (rs) {
     *             return rs.rows;
     *         }
     *     ).then(function (results) {
     *         var bobRows = results[0], johnRows = results[1];
     *         ...
     *     });
     *
     * Other Usage: (multiple `sqlStatement` with multiple sets of `args`)
     *     wsdb.read([{
     *             sql: "SELECT * FROM person WHERE id=?",
     *             args: [23]
     *         }, {
     *             sql: "SELECT * FROM address WHERE state in (?, ?, ?)",
     *             args: ["CA", "FL", "TX"]
     *         }],
     *         // called for each object in args
     *         function (rs) {
     *             return rs.rows;
     *         }
     *     ).then(function (results) {
     *         var person23rows = results[0], addressRows = results[1];
     *         ...
     *     });
     */
    WebSqlSpi.prototype.read = function (sqlStatements, rsCallback) {
        return this.execSqlStatements(this.readTransaction, "read", sqlStatements, rsCallback);
    };
    /** Method for executing a readTransaction with a single `sqlStatement` that's expected to return a single row.
     * The `rowCallback` function is called with the first row in the resultset
     * or with `undefined` if resultset contains no rows.
     * If the query does not return a row, the `defaultValue` is returned instead.
     * @returns promise that resolves with the `rowCallback` result or the row, if no `rowCallback` specified.
     * If no rows are selected and `rowCallback` isn't specified, the promise resolves with the `defaultRow`.
     * The promise is rejected if the query returns multiple rows or if it returns
     * zero rows and no `rowCallback` and `defaultRow` were specified.
     * Usage:
     *     wsdb.readRow("SELECT * FROM person WHERE id = ?", [123], function (row) {
     *         if(!row) {
     *             // person not found
     *         }
     *         else {
     *             ...
     *         }
     *     }).then(function (result) {...});
     */
    WebSqlSpi.prototype.readRow = function (sqlStatements, rowCallback, defaultValue) {
        var util = this.util;
        return util.pipe(this.read(sqlStatements), function (rs) {
            var row;
            if (Array.isArray(rs) || rs.rows.length > 1) {
                return util.rejectError(util.defer(), new Error("Query returned " + (Array.isArray(rs) ? "array of " + rs.length + " result sets" : rs.rows.length + " rows")));
            }
            else if (rs.rows.length === 0) {
                if (defaultValue) {
                    row = defaultValue;
                }
                else if (rowCallback) {
                    row = rowCallback();
                }
                else {
                    return util.rejectError(util.defer(), new Error("Query returned 0 rows"));
                }
            }
            else {
                row = rs.rows.item(0);
                if (rowCallback) {
                    row = rowCallback(row);
                }
            }
            return row;
        });
    };
    WebSqlSpi.prototype.execSqlStatements = function (xactMethod, xactMethodType, sqlStatements, rsCallback) {
        var start = new Date().getTime();
        if (typeof window !== "undefined" && !window["startQueriesTime"]) {
            window["startQueriesTime"] = start;
        }
        var util = this.util;
        var isAry = Array.isArray(sqlStatements);
        var sqls = (isAry ? sqlStatements : [sqlStatements]);
        var results = [];
        var pipeReturn = util.pipe(xactMethod(function (xact) {
            for (var i = 0; i < sqls.length; i++) {
                var cmnd = sqls[i];
                var params = (typeof cmnd.args === "undefined" ? null : cmnd.args);
                if (params == null || params.length === 0) {
                    xact.executeSql(cmnd.sql, null, function (xact, rs) {
                        results.push(rsCallback ? rsCallback(rs) : rs);
                    });
                }
                else {
                    for (var j = 0, szJ = params.length; j < szJ; j++) {
                        xact.executeSql(cmnd.sql, params[j], function (xact, rs) {
                            results.push(rsCallback ? rsCallback(rs) : rs);
                        });
                    }
                }
            }
        }), function () {
            return isAry ? results : results[0];
        }, function (err) {
            err.sql = sqls;
            return err;
        });
        if (util.logTimings) {
            pipeReturn.then(function () {
                var end = new Date().getTime();
                var time = end - start;
                if (typeof window !== "undefined") {
                    window["endQueriesTime"] = end;
                }
                util.log(util.DEBUG, "websql finish args: ", xactMethodType, sqls.length, sqls);
                util.log(util.DEBUG, "websql runtime: ", time);
            });
        }
        return pipeReturn;
    };
    /** Calls window.openDatabase().
     * - version defaults to `""`
     * - displayName defaults to `name`
     * - estimatedSize defaults to `2 * 1024 * 1024`
     * Returns: promise that resolves with this `WebsqlDatabase` instance
     * Usage:
     *     wsdb.openDatabase("test", "Test Database", 2 * 1024 * 1024))
     *         .then(function(wsdb) {...});
     * More usage:
     *     wsdb.openDatabase("test"))
     *         .then(function(wsdb) {...});
     */
    WebSqlSpi.openDatabase = function (util, name, version, displayName, estimatedSize) {
        util.log(util.DEBUG, "openDatabase", name, version, displayName, estimatedSize);
        if (!displayName)
            displayName = name;
        if (!version)
            version = "";
        if (!estimatedSize) {
            if (typeof window !== "undefined" && window.navigator.userAgent.match(/(iPad|iPhone);.*CPU.*OS 7_0/i)) {
                estimatedSize = 5 * 1024 * 1024;
            }
            else {
                estimatedSize = 50 * 1024 * 1024;
            }
        }
        var dfd = util.defer();
        try {
            if (typeof window === "undefined" || !window.openDatabase) {
                util.rejectError(dfd, "WebSQL not implemented");
            }
            else {
                // seems to synchronously open WebSQL, even though window.openDatabase is async
                var db = window.openDatabase(name, version, displayName, estimatedSize);
                if (util.isDatabase(db)) {
                    dfd.resolve(db);
                }
                else {
                    util.rejectError(dfd, "Failed to open database");
                }
            }
        }
        catch (ex) {
            util.rejectError(dfd, "Failed to open database " + name, { exception: ex });
        }
        return dfd.promise;
    };
    WebSqlSpi.newWebSqlDb = function (name, version, displayName, estimatedSize, utilSettings) {
        var util = new DbUtil("WebSQL", "[object Database]", utilSettings);
        // Create WebSQL wrapper from native Database or by opening 'name' DB
        var pOpen;
        if (util.isDatabase(name)) {
            var dfd = util.defer();
            dfd.resolve(name);
            pOpen = dfd.promise;
        }
        else {
            pOpen = WebSqlSpi.openDatabase(util, name, version, displayName, estimatedSize);
        }
        return pOpen.then(function (dbInst) { return new WebSqlSpi(dbInst, util); });
    };
    return WebSqlSpi;
}());
module.exports = WebSqlSpi;

},{"./DbUtil":2}],7:[function(require,module,exports){
"use strict";
var DbUtil = require("../persisters/DbUtil");
var IndexedDbPersister = require("../persisters/IndexedDbPersister");
var IndexedDbSpi = require("../persisters/IndexedDbSpi");
var WebSqlPersister = require("../persisters/WebSqlPersister");
var WebSqlSpi = require("../persisters/WebSqlSpi");
var CollectionsBrowserTestBase;
(function (CollectionsBrowserTestBase) {
    // testing:
    /*
     * load test/tmp/index.html in a browser, then run these commands:
var idb = null; createIndexedDbPersister(1).then((i) => { idb = i; var db = idb.persistenceInterface.db; db.onabort = db.onclose = db.onerror = function closing() { console.error.apply(console, arguments); }; });
idb.addCollection("book", [
  memDb.createBook("1984", "George Orwell", 1949),
  memDb.createBook("Mere Christianity", "C.S. Lewis", 1952),
  memDb.createBook("Desiring God", "John Piper", 1986),
  memDb.createBook("Don't Waste Your Life", "John Piper", 2003),
  memDb.createBook("The Culture Code", "Daniel Coyle", 2016)
]);
idb.getDataCollections()[1].dirty = true;
var rs = null; idb.persist({ maxObjectsPerChunk: 3, keyAutoGenerate: true }).then(r => console.log("persist done!", rs = r), (err) => console.error(err));
var rt = null; idb.restore(null, (name) => ({ isChunks: true })).then(r => console.log("restore done!", rt = r), (err) => console.error(err));
idb.persistenceInterface.db.close();
    */
    var colls = [{
            name: "books",
            data: [],
            dirty: false,
            insert: function insert(dat) { Array.prototype.push.apply(this.data, dat); }
        }];
    var memDb = {
        listCollections: function () { return colls; },
        getCollection: function (name, auto) { return colls.find(function (x) { return x.name === name; }) || colls[0]; },
        createBook: function (name, author, publishYear) { return ({ name: name, author: author, publishYear: publishYear }); },
    };
    var storageLog = {
        error: function error() {
            console.error.apply(console, arguments);
            debugger;
        },
        log: function log() {
            console.log.apply(console, arguments);
            debugger;
        }
    };
    var persisterLog = {
        error: function error() {
            console.error.apply(console, arguments);
            debugger;
        },
        log: function log() {
            console.log.apply(console, arguments);
            debugger;
        }
    };
    var utilConfig = {
        defer: function () {
            var rt = {
                promise: null,
                resolve: null,
                reject: null,
            };
            var p = new Promise(function (rsl, rjc) { rt.resolve = rsl; rt.reject = rjc; });
            rt.promise = p;
            return rt;
        },
        whenAll: function (ps) { return Promise.all(ps); },
        trace: storageLog,
        verbosity: DbUtil.logLevels.DEBUG
    };
    function createIndexedDbPersister(version) {
        if (version === void 0) { version = null; }
        return IndexedDbSpi.newIndexedDb("lokijs-collections-test", version, utilConfig).then(function (idb) {
            return new IndexedDbPersister(idb, persisterLog, function () {
                return [{ name: "book_backup", data: [] }].concat(memDb.listCollections());
            }, function (collName, data) {
                // when initially restoring collection data from persistent storage (during page load) don't mark collection as dirty (prevents a full save when the next persist() timer goes off)
                var initiallyEmpty = memDb.getCollection(collName, false) == null;
                var coll = memDb.getCollection(collName, true);
                coll.insert(data);
                if (initiallyEmpty) {
                    coll.dirty = false;
                }
                return coll;
            }, null /*(itm) => MemDbImpl.cloneCloneDelete(itm, true)*/, null, function (storageError) {
                console.error("storage error, is quota full!?", storageError.sqlError.message);
            }, null, null);
        });
    }
    CollectionsBrowserTestBase.createIndexedDbPersister = createIndexedDbPersister;
    function createWebSqlPersister(version) {
        if (version === void 0) { version = null; }
        return WebSqlSpi.newWebSqlDb("lokijs-collections-test", version, null, null, utilConfig).then(function (wsb) {
            return new WebSqlPersister(wsb, persisterLog, function () {
                return [{ name: "book_backup", data: [] }].concat(memDb.listCollections());
            }, function (collName, data) {
                // when initially restoring collection data from persistent storage (during page load) don't mark collection as dirty (prevents a full save when the next persist() timer goes off)
                var initiallyEmpty = memDb.getCollection(collName, false) == null;
                var coll = memDb.getCollection(collName, true);
                coll.insert(data);
                if (initiallyEmpty) {
                    coll.dirty = false;
                }
                return coll;
            }, null /*(itm) => MemDbImpl.cloneCloneDelete(itm, true)*/, function (k, v) { return (k !== "$loki" && k !== "meta" ? v : undefined); }, null, function (storageError) {
                console.error("storage error, is quota full!?", storageError.sqlError.message);
            }, null, null);
        });
    }
    CollectionsBrowserTestBase.createWebSqlPersister = createWebSqlPersister;
    var Cctor = (function () {
        var globals = [
            IndexedDbPersister,
            IndexedDbSpi,
            createIndexedDbPersister,
            createWebSqlPersister,
            (colls.name = "colls", colls),
            (memDb.name = "memDb", memDb),
        ];
        for (var i = 0, size = globals.length; i < size; i++) {
            var glb = globals[i];
            window[glb.name] = glb;
            console.log(glb.name);
        }
    }());
})(CollectionsBrowserTestBase || (CollectionsBrowserTestBase = {}));
module.exports = CollectionsBrowserTestBase;

},{"../persisters/DbUtil":2,"../persisters/IndexedDbPersister":3,"../persisters/IndexedDbSpi":4,"../persisters/WebSqlPersister":5,"../persisters/WebSqlSpi":6}]},{},[7])
//# sourceMappingURL=bundle.js.map
