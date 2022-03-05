async function updateProblemsFromStats(problem) {
  const stats = await getStats();
  stats.problems[problem.problemId] = {
    problem_description: problem.problem_description,
    problem_input: problem.problem_input,
    problem_output: problem.problem_output,
  };
  console.log("stats", stats);
  await saveStats(stats);
}

async function getProblemsfromStats(problemId) {
  const stats = await getStats();
  console.log("stats.problems[problemId]", stats.problems[problemId]);
  return stats.problems[problemId] ?? {};
}
