LokiJS Collections
==============

Strongly typed TypeScript collection wrappers for [lokiJS] (https://github.com/techfort/LokiJS). 

####db-collections/
Contains 'DataCollection', a wrapper for a loki.js collection, add/remove/update functions modify the underlying loki.js collection.  Also contains 'LokiDbImpl' which bridges the gap between an untyped loki.js instance and 'DataCollection'. 

####change-trackers/
Collections and handlers for tracking lokijs collection changes (i.e. updates, additions, deletions). 

####key-constraints/
Collection meta-data and unique/primary key constraint handlers for 'DataCollection'. 
Includes:
'PrimaryKeyMaintainer' for checking uniqueness of primary keys and/or generating numerical keys (i.e. 1, 2, 3, ...), 
'NonNullKeyMaintainer' for checking that fields have values