async function updateProblemsFromStats(problem) {
  await deleteOldProblemDescriptions();
  const stats = await getStats();
  stats.problems[problem.problemId] = {
    problem_description: problem.problem_description,
    problem_input: problem.problem_input,
    problem_output: problem.problem_output,
    save_date: new Date().getTime()
  };
  if(debug) console.log('problem date', stats.problems[problem.problemId].save_date);
  if(debug) console.log('stats', stats);
  await saveStats(stats);
}

async function getProblemsfromStats(problemId) {
  const stats = await getStats();
  console.log("stats.problems[problemId]", stats.problems[problemId]);
  return stats.problems[problemId] ?? {};
}

/**
 * Local Storage 정리 함수
 * 1주가 넘은 문제 요약 삭제
 */
async function deleteOldProblemDescriptions(){
  const stats = await getStats();
  if(!stats.last_check_date){
    stats.last_check_date = new Date().getTime();
    await saveStats(stats);
    if(debug) console.log("Initialized stats date", stats.last_check_date);
    return;
  }
  else{
    let date_yesterday = new Date() - 86400000; // 24 * 60 * 60 * 1000 = 86400000 ms = 1day
    if(debug) console.log('금일 로컬스토리지 정리를 완료하였습니다.');
    if(date_yesterday<stats.last_check_date) return;
  }
  // 1 주가 지난 문제 내용은 삭제
  let date_week_ago = new Date()- 7* 86400000;
  if(debug) console.log('stats before deletion', stats);
  console.log('date a week ago', date_week_ago);
  for(const [key, value] of Object.entries(stats.problems)){
    // 무한 방치를 막기 위해 저장일자가 null이면 삭제
    if(!value || !value.save_date){
      delete stats.problems[key]; 
    }
    else{
      let problem_save_date = new Date(value.save_date);
      // 1주가 지난 코드는 삭제
      if(date_week_ago > problem_save_date){
        delete stats.problems[key];
      }
    }
  }
  stats.last_check_date = new Date().getTime();
  if(debug) console.log('stats after deletion', stats);
  await saveStats(stats);
}