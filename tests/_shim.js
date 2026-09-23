// 新しい solver.js は関数群を solverModule() の中に閉じ込めたので、
// 旧テストが使っていた名前を、新 API に橋渡しする。
const __S = solverModule();
const __P = () => buildProblem();
const solvePuzzle = (start, goal, budget, fallbackRuns) =>
  __S.solvePuzzle(__P(), start, goal, budget, fallbackRuns ? __S.runsToPlan(fallbackRuns) : null);
const planToRuns = (plan, startLay) => __S.planToRuns(__P(), plan, startLay);
const runsToPlan = (runs) => __S.runsToPlan(runs);
const HINT_BUDGET = hintBudgetWorker();  // ゲームが実際に使う予算に合わせる
// solver.js 内に移った補助関数。script.js の同等物を使う
const orderOfCycles = (cyc) => orderOf(cyc);
