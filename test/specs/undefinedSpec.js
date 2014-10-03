var util = require("util");
var Promise = require('es6-promise').Promise;

/**
 * Return promise, returns (func(data) == result)
 * If result is function return result(func(data))
 *
 * func - test function(data, resolved, rejected)
 * data - test data
 * result - function result
 */
function Test(func, data, result, label){
    return (new Promise(function(res, rej){
        func(data, res, rej);
    })).then(function(funcResult){
            var testResult = (typeof result == "function") ? result(funcResult) : funcResult == result;
            if (label)util.log('test;', '"' + label + '"', testResult ? '-completed' : '-failed');
            return testResult;
        }).catch(function(error){
            if (label) util.log('test;',  '"' + label + '"', '-rejected', error);
        });
}

module.exports = Test;