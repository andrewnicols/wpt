// META: global=window,worker
// META: script=/common/get-host-info.sub.js
// META: script=/common/utils.js
// META: script=resources/webtransport-test-helpers.sub.js

// Note: There is no aioquic event for STOP_SENDING yet, so the server does
// not support checking this yet. Hence, tests checking from the STOP_SENDING
// signal cannot be tested yet.

promise_test(async t => {
  const id = token();
  let wt = new WebTransport(webtransport_url(`client-close.py?token=${id}`));
  await wt.ready;

  const bidi_stream = await wt.createBidirectionalStream();

  const writable = bidi_stream.writable;

  const WT_CODE = 139;
  const HTTP_CODE = webtransport_code_to_http_code(WT_CODE);
  await writable.abort(
      new WebTransportError({streamErrorCode: WT_CODE}));

  await wait(10);

  wt = new WebTransport(webtransport_url(`query.py?token=${id}`));
  await wt.ready;

  const streams = await wt.incomingUnidirectionalStreams;
  const streams_reader = streams.getReader();
  const { value: readable }  = await streams_reader.read();
  streams_reader.releaseLock();

  const data = await read_stream_as_json(readable);

  // Check that stream is aborted with RESET_STREAM with the code and reason
  assert_own_property(data, 'stream-close-info');
  const info = data['stream-close-info'];

  assert_equals(info.source, 'reset', 'reset stream');
  assert_equals(info.code, HTTP_CODE, 'code');
}, 'Abort client-created bidirectional stream');

promise_test(async t => {
  const id = token();
  let wt = new WebTransport(webtransport_url(`client-close.py?token=${id}`));
  await wt.ready;

  const stream_reader = wt.incomingBidirectionalStreams.getReader();
  const { value: bidi_stream } = await stream_reader.read();
  stream_reader.releaseLock();

  const writer = bidi_stream.writable.getWriter();

  const WT_CODE = 52;
  const HTTP_CODE = webtransport_code_to_http_code(WT_CODE);
  await writer.abort(
      new WebTransportError({streamErrorCode: WT_CODE}));

  await wait(10);

  wt = new WebTransport(webtransport_url(`query.py?token=${id}`));
  await wt.ready;

  const streams = await wt.incomingUnidirectionalStreams;
  const streams_reader = streams.getReader();
  const { value: readable } = await streams_reader.read();
  streams_reader.releaseLock();

  const data = await read_stream_as_json(readable);

  // Check that stream is aborted with RESET_STREAM with the code and reason
  assert_own_property(data, 'stream-close-info');
  const info = data['stream-close-info'];

  assert_equals(info.source, 'reset', 'reset_stream');
  assert_equals(info.code, HTTP_CODE, 'code');
}, 'Abort server-initiated bidirectional stream');

promise_test(async t => {
  const id = token();
  const wt = new WebTransport(webtransport_url(`client-close.py?token=${id}`));
  add_completion_callback(() => wt.close());
  await wt.ready;

  const writable = await wt.createUnidirectionalStream();

  const WT_CODE = 95;
  const HTTP_CODE = webtransport_code_to_http_code(WT_CODE);
  await writable.abort(
      new WebTransportError({streamErrorCode: WT_CODE}));

  await wait(10);
  const data = await query(id);

  // Check that stream is aborted with RESET_STREAM with the code and reason
  assert_own_property(data, 'stream-close-info');
  const info = data['stream-close-info'];

  assert_equals(info.source, 'reset', 'reset_stream');
  assert_equals(info.code, HTTP_CODE, 'code');
}, 'Abort unidirectional stream with WebTransportError');

promise_test(async t => {
  const id = token();
  const wt = new WebTransport(webtransport_url(`client-close.py?token=${id}`));
  add_completion_callback(() => wt.close());
  await wt.ready;

  const writable = await wt.createUnidirectionalStream();
  const writer = writable.getWriter();

  const WT_CODE = 134;
  const HTTP_CODE = webtransport_code_to_http_code(WT_CODE);

  // Write a chunk, close the stream, and then abort the stream immediately to
  // abort the closing operation.
  writer.write(new Uint8Array([32]));
  writer.close();
  await writer.abort(
      new WebTransportError({streamErrorCode: WT_CODE}));

  writer.releaseLock();

  await wait(10);
  const data = await query(id);

  // Check that stream is aborted with RESET_STREAM with the code and reason
  assert_own_property(data, 'stream-close-info');
  const info = data['stream-close-info'];

  assert_equals(info.source, 'reset', 'reset_stream');
  assert_equals(info.code, HTTP_CODE, 'code');
}, 'Close and abort unidirectional stream');

promise_test(async t => {
  const id = token();
  const wt = new WebTransport(webtransport_url(`client-close.py?token=${id}`));
  add_completion_callback(() => wt.close());
  await wt.ready;

  const writable = await wt.createUnidirectionalStream();
  await writable.abort();

  await wait(10);
  const data = await query(id);

  // Check that stream is aborted with RESET_STREAM with the code and reason
  assert_own_property(data, 'stream-close-info');
  const info = data['stream-close-info'];

  assert_equals(info.source, 'reset', 'reset_stream');
  assert_equals(info.code, webtransport_code_to_http_code(0), 'code');
}, 'Abort unidirectional stream with default error code');

promise_test(async t => {
  const WT_CODE = 240;
  const HTTP_CODE = webtransport_code_to_http_code(WT_CODE);
  const wt = new WebTransport(
    webtransport_url(`abort-stream-from-server.py?code=${HTTP_CODE}`));
  add_completion_callback(() => wt.close());
  await wt.ready;

  const writable = await wt.createUnidirectionalStream();
  const writer = writable.getWriter();

  // Write something, to make the stream visible to the server side.
  await writer.write(new Uint8Array([64]));

  // Sadly we cannot use promise_rejects_dom as the error constructor is
  // WebTransportError rather than DOMException. Ditto below.
  // We get a possible error, and then make sure wt.closed is rejected with it.
  const e = await writer.closed.catch(e => e);
  await promise_rejects_exactly(
      t, e, writer.closed, 'closed promise should be rejected');
  assert_true(e instanceof WebTransportError);
  assert_equals(e.source, 'stream', 'source');
  assert_equals(e.streamErrorCode, WT_CODE, 'streamErrorCode');
}, 'STOP_SENDING coming from server');

promise_test(async t => {
  const WT_CODE = 127;
  const HTTP_CODE = webtransport_code_to_http_code(WT_CODE);
  const wt = new WebTransport(
    webtransport_url(`abort-stream-from-server.py?code=${HTTP_CODE}`));
  add_completion_callback(() => wt.close());
  await wt.ready;

  const bidi = await wt.createBidirectionalStream();
  const writer = bidi.writable.getWriter();

  // Write something, to make the stream visible to the server side.
  await writer.write(new Uint8Array([64]));

  const reader = bidi.readable.getReader();
  const e = await reader.closed.catch(e => e);
  await promise_rejects_exactly(
      t, e, reader.closed, 'closed promise should be rejected');
  assert_true(e instanceof WebTransportError);
  assert_equals(e.source, 'stream', 'source');
  assert_equals(e.streamErrorCode, WT_CODE, 'streamErrorCode');
}, 'RESET_STREAM coming from server');
