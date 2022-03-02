<script>
  const { writeFile, readFile } = require("fs/promises");
  const { serialize, deserialize } = require("@ygoe/msgpack");
  const { get, set } = require("idb-keyval");

  const ROUND_TO_2DP = (x) => Math.round(x * 100) / 100;

  const testObj = { foo: ["bar", 5, true], baz: null };

  function buildTestList(size) {
    const list = [];
    for (let i = 0; i < size; i++) list.push(testObj);
    return list;
  }

  async function testRuntime(
    testFunc,
    iterations = 10,
    warmupIters = 5,
    cleanupFunc = () => {}
  ) {
    const results = [];
    for (let i = 0; i < warmupIters; i++) {
      await testFunc();
      await cleanupFunc();
    }

    for (let i = 0; i < iterations; i++) {
      performance.mark(`start-${i}`);
      await testFunc();
      performance.mark(`end-${i}`);
      await cleanupFunc();
    }

    for (let i = 0; i < iterations; i++)
      results.push(
        performance.measure(`measure-${i}`, `start-${i}`, `end-${i}`).duration
      );

    performance.clearMarks();
    performance.clearMeasures();

    const mean = results.reduce((last, curr) => last + curr) / results.length;
    const median = results.sort()[Math.floor((results.length + 1) / 2)];
    return { mean, median, results };
  }

  async function runNodeJsonTest(listLength) {
    const testList = buildTestList(listLength);
    const writeResults = await testRuntime(async () => {
      await writeFile("temp.txt", JSON.stringify(testList));
    });
    const readResults = await testRuntime(async () => {
      JSON.parse(await readFile("temp.txt"));
    });
    return [readResults.median, writeResults.median];
  }

  async function runNodeMsgpackTest(listLength) {
    const testList = buildTestList(listLength);
    const writeResults = await testRuntime(async () => {
      await writeFile("temp", serialize(testList));
    });
    const readResults = await testRuntime(async () => {
      deserialize(await readFile("temp.txt"));
    });
    return [readResults.median, writeResults.median];
  }

  async function runIdbKeyvalTest(listLength) {
    const testList = buildTestList(listLength);
    const writeResults = await testRuntime(async () => {
      await set("temp", testList);
    });
    const readResults = await testRuntime(async () => {
      await get("temp");
    });
    return [readResults.median, writeResults.median];
  }

  const tests = [
    ["10k", 10_000, null, null, null, null, null, null],
    ["100k", 100_000, null, null, null, null, null, null],
    ["250k", 250_000, null, null, null, null, null, null],
    ["500k", 500_000, null, null, null, null, null, null],
    ["750k", 750_000, null, null, null, null, null, null],
    //["1m", 1_000_000, null, null, null, null, null, null],
    //["5m", 5_000_000, null, null, null, null, null, null],
    //["10m", 10_000_000, null, null, null, null, null, null],
  ];

  let currentlyTesting = " ";

  // async moment
  (async () => {
    for (let i = 0; i < tests.length; i++) {
      currentlyTesting = "node json " + tests[i][0];
      const [read, write] = await runNodeJsonTest(tests[i][1]);
      tests[i][2] = read;
      tests[i][3] = write;
    }

    for (let i = 0; i < tests.length; i++) {
      currentlyTesting = "node msgpack " + tests[i][0];
      const [read, write] = await runNodeMsgpackTest(tests[i][1]);
      tests[i][4] = read;
      tests[i][5] = write;
    }

    for (let i = 0; i < tests.length; i++) {
      currentlyTesting = "idb keyval " + tests[i][0];
      const [read, write] = await runIdbKeyvalTest(tests[i][1]);
      tests[i][6] = read;
      tests[i][7] = write;
    }

    currentlyTesting = null;
  })();
</script>

<h1>NW.JS NODE FS VS IDB TEST</h1>

<h2>Test object used:</h2>
<p>An array of varying amounts of the following:</p>
<p />
<pre><code>
&lbrace;
	"foo": ["bar", 5, true],
	"baz": null
&rbrace;
</code></pre>

<h2>Notes</h2>
<p>
  The Node benchmarks include the time to convert the object to and from JSON or
  MessagePack.
</p>
<p>
  This is because IDB Keyval can take full objects, so the benchmarks for the
  node tests must also accept objects rather than just strings or bytes.
</p>
<p>
  All displayed results are median values.
</p>

{#if currentlyTesting}
  <h2>Currently testing, please wait: {currentlyTesting}</h2>
{:else}
  <h2>Test results:</h2>
  <table>
    <thead>
      <tr>
        <th>list length</th>
        <th>Node FS JSON read</th>
        <th>Node FS JSON write</th>
        <th>Node FS MSGPACK read</th>
        <th>Node FS MSGPACK write</th>
        <th>Chromium idb-keyval read</th>
        <th>Chromium idb-keyval write</th>
      </tr>
    </thead>
    <tbody>
      {#each tests as test}
        <tr>
          <th>{test[0]}</th>
          {#each test.slice(2) as result}
            <td>{ROUND_TO_2DP(result)}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<style>
  table { border-collapse: collapse; }
  th, td {
    border: 1px solid black;
    padding: 0.5rem;
  }
  th { font-style: italic; }
</style>
