const { writeFile, readFile } = require("fs/promises");
const { serialize, deserialize } = require("@ygoe/msgpack");

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

const tests = [
  ["10k", 10_000, null, null, null, null],
  ["100k", 100_000, null, null, null, null],
  ["250k", 250_000, null, null, null, null],
  ["500k", 500_000, null, null, null, null],
  ["750k", 750_000, null, null, null, null],
  //["1m", 1_000_000, null, null, null, null],
  //["5m", 5_000_000, null, null, null, null],
  //["10m", 10_000_000, null, null, null, null],
];

// async moment
(async () => {
  for (let i = 0; i < tests.length; i++) {
    console.log("currently testing: node json " + tests[i][0]);
    const [read, write] = await runNodeJsonTest(tests[i][1]);
    tests[i][2] = read;
    tests[i][3] = write;
  }

  for (let i = 0; i < tests.length; i++) {
    console.log("currently testing: node msgpack " + tests[i][0]);
    const [read, write] = await runNodeMsgpackTest(tests[i][1]);
    tests[i][4] = read;
    tests[i][5] = write;
  }

  console.log("list length,\tnode json read,\tnode json write,\tnode msgpack read,\tnode msgpack write");
  for (const test of tests)
    console.log([test[0]].concat(test.slice(2).map(ROUND_TO_2DP)).join(",\t"));
})();
