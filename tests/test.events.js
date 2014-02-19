'use strict';

var adapters = [
  'http-1',
  'local-1'
];
var testHelpers = {};
describe('events', function () {
  adapters.map(function (adapter) {
    describe(adapter, function () {
      beforeEach(function () {
        testHelpers.name = testUtils.generateAdapterUrl(adapter);
        PouchDB.enableAllDbs = false;
      });
      afterEach(testUtils.cleanupTestDatabases);
      it('emit creation event', function (done) {
        var db = new PouchDB(testHelpers.name).on('created', function (newDB) {
          db.should.equal(newDB, 'should be same thing');
          done();
        });
      });
      it('emit changes event', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          var id = 'emiting';
          var obj = {
            something: 'here',
            somethingElse: 'overHere'
          };
          db.on('change', function (change) {
            change.seq.should.equal(1);
            change.id.should.equal('emiting');
            db.removeAllListeners('change');
            done(err);
          });
          if (adapter === 'http-1') {
            setTimeout(function () {
              db.put(obj, id);
            }, 100);
          } else {
            db.put(obj, id);
          }
        });
      });
      it('emit create event', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          var id = 'emiting';
          var obj = {
            something: 'here',
            somethingElse: 'overHere'
          };
          db.on('create', function (change) {
            change.seq.should.equal(1);
            change.id.should.equal('emiting');
            db.removeAllListeners('create');
            done(err);
          });
          if (adapter === 'http-1') {
            setTimeout(function () {
              db.put(obj, id);
            }, 100);
          } else {
            db.put(obj, id);
          }
        });
      });
      it('emit update event', function (done) {
        testUtils.initTestDB(testHelpers.name, function (err, db) {
          var id = 'emiting';
          var obj = {
            something: 'here',
            somethingElse: 'overHere'
          };
          db.on('update', function (change) {
            change.seq.should.equal(2);
            change.id.should.equal('emiting');
            db.removeAllListeners('update');
            done(err);
          });

          setTimeout(function () {
            db.put(obj, id).then(function (doc) {
              db.put({'something': 'else'}, id, doc.rev);
            });
          }, 100);
         
        });
      });
    });
  });
});