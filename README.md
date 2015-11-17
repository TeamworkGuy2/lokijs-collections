LokiJS Collections
==============

A strongly typed TypeScript library for loki.js [https://github.com/techfort/LokiJS] collections. 

####db-collections/
Contains 'DataCollection', a wrapper for a loki.js collection, add/remove/update functions modify the underlying loki.js collection.  Also contains 'LokiDbImpl' which bridges the gap between an untyped loki.js instance and 'DataCollection'. 

####change-trackers/
Collections and handlers for tracking lokijs collection changes (i.e. updates, additions, deletions). 

####key-constraints/
Collection meta-data and unique/primary key constraint handlers for 'DataCollection'. 