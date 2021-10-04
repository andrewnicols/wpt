// META: global=window
let code = new Uint8Array([0x53, 0x61, 0x6d, 0x70, 0x6c, 0x65, 0]);
var A = async_test(t => {
  self.addEventListener('securitypolicyviolation', e => {
    t.step(function(){
      assert_equals(e.violatedDirective, "script-src");
      assert_equals(e.originalPolicy, "default-src 'self'")
    })
    t.done();
  });
}, "Securitypolicyviolation event looks like it should");

promise_test(t => {
  return promise_rejects_js(
      t, WebAssembly.CompileError,
      WebAssembly.instantiate(code));
});



