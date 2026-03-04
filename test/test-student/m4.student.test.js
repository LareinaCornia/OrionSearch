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
    if(e){ done(e); return; }

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

  distribution.local.store.put(user,key,(e,v)=>{
    if(e){ done(e); return; }

    distribution.local.store.get(key,(e,v)=>{
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

          // mem.get(null) 返回 array
          expect(Array.isArray(v)).toBe(true);
          expect(v.length).toBeGreaterThanOrEqual(2);

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

          // store.get(null) 返回 array
          expect(Array.isArray(v)).toBe(true);
          expect(v.length).toBeGreaterThanOrEqual(2);

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

  // 使用 local.mem 避免 all group 未初始化
  distribution.local.mem.put(user, "isoKey", () => {
    distribution.mygroup.mem.get(null, (e, v) => {
      try{
        if(v) {
          const serialized = JSON.stringify(v);
          expect(serialized).not.toContain("isoKey");
        }
        done();
      }catch(err){
        done(err);
      }
    });
  });
});


const n1 = {ip:'127.0.0.1', port:8000};
const n2 = {ip:'127.0.0.1', port:8001};
const n3 = {ip:'127.0.0.1', port:8002};

const mygroupGroup = {};

beforeAll((done) => {

  mygroupGroup[id.getSID(n1)] = n1;
  mygroupGroup[id.getSID(n2)] = n2;
  mygroupGroup[id.getSID(n3)] = n3;

  distribution.node.start((e)=>{
    if(e){done(e); return;}

    distribution.local.status.spawn(n1, ()=>{
      distribution.local.status.spawn(n2, ()=>{
        distribution.local.status.spawn(n3, ()=>{

          const config = {gid:'mygroup'};

          distribution.local.groups.put(config,mygroupGroup,()=>{

            distribution.mygroup.groups.put(config,mygroupGroup,()=>{

              done();

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
        if(globalThis.distribution.node.server){
          globalThis.distribution.node.server.close();
        }
        done();
      });
    });
  });

});