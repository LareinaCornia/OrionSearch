/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

const id = distribution.util.id;

test('(1 pts) student test', (done) => {
  const user = {first:'Tom', last:'Jerry'};
  const key = "student-mem-key";

  distribution.mygroup.mem.put(user, key, (e,v)=>{
    distribution.mygroup.mem.get(key,(e,v)=>{
      try{
        expect(e).toBeFalsy();
        expect(v).toEqual(user);
        done();
      }catch(err){
        done(err);
      }
    });
  });
});


test('(1 pts) student test', (done) => {
  const user = {first:'Store', last:'Test'};
  const key = "student-store-key";

  distribution.local.mem.put(user,key,(e,v)=>{
    distribution.local.mem.get(key,(e,v)=>{
      try{
        expect(e).toBeFalsy();
        expect(v).toEqual(user);
        done();
      }
      catch(err){
        done(err);
      }
    });
  });
});


test('(1 pts) student test', (done) => {
  const user1 = {first:'Jerry', last:'A'};
  const user2 = {first:'Jerry', last:'B'};

  distribution.mygroup.mem.put(user1,"m1",()=>{
    distribution.mygroup.mem.put(user2,"m2",()=>{
      distribution.mygroup.mem.get(null,(e,v)=>{
        try{
          expect(e).toEqual({});
          expect(Object.values(v)).toEqual(
            expect.arrayContaining(["m1","m2"])
          );
          done();
        }catch(err){
          done(err);
        }
      });
    });
  });
});


test('(1 pts) student test', (done) => {
const user1 = {first:'Store', last:'A'};
  const user2 = {first:'Store', last:'B'};

  distribution.mygroup.store.put(user1,"s1",()=>{
    distribution.mygroup.store.put(user2,"s2",()=>{
      distribution.mygroup.store.get(null,(e,v)=>{
        try{
          expect(e).toEqual({});
          expect(Object.values(v)).toEqual(
            expect.arrayContaining(["s1","s2"])
          );
          done();
        }catch(err){
          done(err);
        }
      });
    });
  });
});


test('(1 pts) student test', (done) => {
  const user = {first:'Isolation', last:'Test'};
  distribution.all.mem.put(user, "isoKey", () => {
    distribution.mygroup.mem.get(null, (e, v) => {
      try{
        if(v) {
          expect(Object.values(v)).not.toContain("isoKey");
        }
        done();
      }catch(err){
        done(err);
      }
    });
  });
});

const mygroupGroup = {};

const n1 = {ip:'127.0.0.1', port:8000};
const n2 = {ip:'127.0.0.1', port:8001};
const n3 = {ip:'127.0.0.1', port:8002};
const n4 = {ip:'127.0.0.1', port:8003};
const n5 = {ip:'127.0.0.1', port:8004};
const n6 = {ip:'127.0.0.1', port:8005};

beforeAll((done)=>{
  const remote = {service:'status', method:'stop'};
  remote.node = n1;
  distribution.local.comm.send([],remote,()=>{
    remote.node = n2;
    distribution.local.comm.send([],remote,()=>{
      remote.node = n3;
      distribution.local.comm.send([],remote,()=>{
        remote.node = n4;
        distribution.local.comm.send([],remote,()=>{
          remote.node = n5;
          distribution.local.comm.send([],remote,()=>{
            remote.node = n6;
            distribution.local.comm.send([],remote,()=>{
            });
          });
        });
      });
    });
  });


  mygroupGroup[id.getSID(n1)] = n1;
  mygroupGroup[id.getSID(n2)] = n2;
  mygroupGroup[id.getSID(n3)] = n3;


  distribution.node.start((e)=>{
    if(e){
      done(e);
      return;
    }

    const groupInstantiation = ()=>{
      const mygroupConfig = {gid:'mygroup'};
      distribution.local.groups.put(
        mygroupConfig,
        mygroupGroup,
        (e, v) => {
          distribution.mygroup.groups.put(
            mygroupConfig,
            mygroupGroup,
            (e, v) => {
              done();
            }
          );
        }
      );

    };


    distribution.local.status.spawn(n1,(e)=>{
      if(e){done(e);return;}
      distribution.local.status.spawn(n2,(e)=>{
        if(e){done(e);return;}
        distribution.local.status.spawn(n3,(e)=>{
          if(e){done(e);return;}
          distribution.local.status.spawn(n4,(e)=>{
            if(e){done(e);return;}
            distribution.local.status.spawn(n5,(e)=>{
              if(e){done(e);return;}
              distribution.local.status.spawn(n6,(e)=>{
                if(e){done(e);return;}
                groupInstantiation();
              });
            });
          });
        });
      });
    });
  });
});



afterAll((done)=>{
  const remote = {service:'status', method:'stop'};
  remote.node = n1;
  distribution.local.comm.send([],remote,()=>{
    remote.node = n2;
    distribution.local.comm.send([],remote,()=>{
      remote.node = n3;
      distribution.local.comm.send([],remote,()=>{
        remote.node = n4;
        distribution.local.comm.send([],remote,()=>{
          remote.node = n5;
          distribution.local.comm.send([],remote,()=>{
            remote.node = n6;
            distribution.local.comm.send([],remote,()=>{
              if(globalThis.distribution.node.server){
                globalThis.distribution.node.server.close();
              }
              done();
            });
          });
        });
      });
    });
  });
});