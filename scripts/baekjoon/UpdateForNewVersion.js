/* 
  백준 업데이트 시 호환성을 보장하기 위한 스크립트입니다.
  버전마다 내용이 다르며 버전이 다를 때만 사용되어야합니다.
*/

function insertUpdateButton() {

  const button = createButton('업데이트 실행');
  button.onclick = updateAlert;
  const target = document.getElementById('status-table').childNodes[1].childNodes[0].childNodes[3];
  if (target.childNodes.length > 0) {
    target.childNodes[0].append(button);
  }
}

function updateAlert() {
  if (confirm('업데이트 전에 팝업의 링크를 통해 패치 노트를 확인해주세요')) {
    updateLocalStorageAndGit();
  }
}

/* 추후 개발 예정 */
async function updateLocalStorageAndGit() { 

  // const bojData = await ufindData(37035300);
  chrome.storage.local.get('BaekjoonHub_token', (t) => {
    const token = t.BaekjoonHub_token;
    if (token) {
      chrome.storage.local.get('mode_type', (m) => {
        const mode = m.mode_type;
        if (mode === 'commit') {
          chrome.storage.local.get('BaekjoonHub_hook', (h) => {
            const hook = h.BaekjoonHub_hook;
            if (hook) {
              chrome.storage.local.get('stats', (data) =>{
                let { stats } = data;
                if(stats){
                  const replacementFiles = [];
                  const deleteList = [];
                  Object.entries(stats.submission).map(stat  => {
                    if(stat[1].readmeSha === undefined || stat[1].readmeSha === null){
                      replacementFiles.push(stat[1].submissionId);
                    }
                  })
                  const startDate = Date.parse("2021-12-25");
                  console.log('replacementFiles in updateLocalStorage', replacementFiles);

                  /* array to get final list */
                  const parsedDelList = replacementFiles.map(async subId =>{
                    let bojData = await ufindData(subId);
                    return fetch(`https://api.github.com/repos/${hook}/contents/${bojData.meta.directory}/`, {
                        method: 'GET',
                        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
                      })
                      .then(res => {
                        if(!res.ok){
                          throw Error(res.statusText);
                        }
                        return res.json();
                      })
                      .then((data) =>{
                        if(data.length < 2){
                          throw Error(data);
                        }
                        console.log(data);

                        
                        return ( async () => {
                          return fetch(`https://api.github.com/repos/${hook}/commits?path=${encodeURIComponent(data[0].path)}&page=1&per_page=1`, {
                            method: 'GET',
                            headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
                          })
                          .then(res => res.json())
                          .then(resJson =>{
                            console.log('resJson', resJson, Date.parse(resJson[0].commit.committer.date));
                            if(startDate < Date.parse(resJson[0].commit.committer.date)){
                              console.log(`deleteList ${data[0].path}`, deleteList);
                              return {
                                'problemId': bojData.problemId,
                                'key': bojData.meta.problemId + bojData.meta.problemId + bojData.meta.language,
                                'file1': data[0].path,
                                // 'Url1': data[0].url,
                                'Sha1': data[0].sha,
                                'file2': data[1].path,
                                // 'Url2': data[1].url,
                                'Sha2': data[1].sha,
                                'CommitDate': resJson[0].commit.committer.date
                              };
                            }
                            else return null;
                          })
                          .catch(errorDate => console.log(errorDate));
                        })();
                      })
                      .catch(error => {
                        console.log(`${bojData.meta.problemId}:${bojData.meta.title}`, error);
                      })
                  });
                  

                  Promise.all(parsedDelList)
                  .then(prom => Promise.all(prom))
                  .then(data =>{
                    if(debug) console.log('parsedDelList', data);

                    const refinedDelList = data.filter(elem => elem !== undefined);
                    if(debug) console.log('refinedDelList', refinedDelList);
                    
                    // window.alert(notification);
                    insertBoard(refinedDelList, token, hook);
                  })
                }
              });
            }
          });
        }
      });
    }
  });
}

async function ufindData(subId) {
  const bojData = {
    // Meta data of problem
    meta: {
      title: '',
      problemId: '',
      level: '',
      problemDescription: '',
      language: '',
      message: '',
      fileName: '',
      category: '',
      readme: '',
      directory: '',
    },
    submission: {
      submissionId: '',
      code: '',
      memory: '',
      runtime: '',
    },
  };

  try {
    const { 
      username, 
      result, 
      memory, 
      runtime, 
      language, 
      submissionTime, 
      submissionId, 
      problemId 
    } = await ufindFromResultTable(subId);
    const {
      title, 
      level, 
      code,
      tags,
      problem_description, 
      problem_input, 
      problem_output 
    } = await findProblemDetailsAndSubmissionCode(problemId, submissionId);
    const problemDescription = `### 문제 설명\n\n${problem_description}\n\n`
                            + `### 입력 \n\n ${problem_input}\n\n`
                            + `### 출력 \n\n ${problem_output}\n\n`;
    
    const directory = `${title.replace(/\s+/g, '-')}`;
    const message = `[${level}] Title: ${title}, Time: ${runtime} ms, Memory: ${memory} KB -BaekjoonHub`;
    const tagl = [];
    tags.forEach((tag) => tagl.push(`${categories[tag.key]}(${tag.key})`));
    const category = tagl.join(', ');
    const fileName = `title.replace(/\s+/g, '-')` + ulanguages[language];
    const readme = `# [${level}] ${title} - ${problemId} \n\n` 
                + `[문제 링크](https://www.acmicpc.net/problem/${problemId}) \n\n`
                + `### 성능 요약\n\n`
                + `메모리: ${memory} KB, `
                + `시간: ${runtime} ms\n\n`
                + `### 분류\n\n`
                + `${category}\n\n`
                + `${problemDescription}\n\n`;
    return {
      meta: {
        title,
        problemId,
        level,
        problemDescription,
        language,
        message,
        fileName,
        category,
        readme,
        directory,
      },
      submission: {
        submissionId,
        code,
        memory,
        runtime,
      },
    };
  } catch (error) {
    console.error(error);
  }
  return bojData;
}

async function ufindFromResultTable(subId) {
  if (!isExistResultTable()) {
    if (debug) console.log('Result table not found');
  }
  const resultList = await ufindResultTableList(subId);
  if (resultList.length === 0) return;
  const row = resultList[0];
  return row;
}


/*
  findResuleTableList for 
*/
async function ufindResultTableList(submissionId) {

  return await fetch(`https://www.acmicpc.net/source/${submissionId}`)
  .then((res)=> res.text())
  .then((data)=>{
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(data, 'text/html');
    
    const table = doc.getElementsByClassName('table-striped')[0];
    if (table === null || table === undefined || table.length === 0) return [];
    const headers = Array.from(table.rows[0].cells, (x) => convertResultTableHeader(x.innerText.trim()));
    const list = [];
    for (let i = 1; i < table.rows.length; i++) {
      const row = table.rows[i];
      const cells = Array.from(row.cells, (x, index) => {
        switch (headers[index]) {
          case 'language':
            return x.innerText.unescapeHtml().replace(/\/.*$/g, '').trim();
          case 'submissionTime':
            return x.firstChild.getAttribute('data-original-title');
          default:
            return x.innerText.trim();
        }
      });
      const obj = {};
      obj.element = row;
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = cells[j];
      }
      list.push(obj);
    }
    return list;
  })
  .catch((error) => {
    console.log("error in uFindResultTableList", error);
    return [];
  })
}


// Languages supported by BOJ
const ulanguages = {
  'Python 3': '.py',
  'PyPy3': '.py',
  'C++': '.cpp',
  'C++17': '.cpp',
  'C++17 (Clang)': '.cpp',
  'C99': '.c',
  'D': '.d',
  'Java 11': '.java',
  'C# 9.0 (.NET)': '.cs',
  'node.js': '.js',
  'Ruby': '.rb',
  'Swift': '.swift',
  'Go': '.go',
  'Kotlin (JVM)': '.kt',
  'Rust 2018': '.rs',
  'MS SQL Server': '.sql'
};


function insertBoard(delList, token, hook){

  let notification = "백준허브 1.0.2 버전 패치에는 파일 저장 형식 변경이 있어 <u>백준허브</u>로 기존에 제출되었던 문제가 제거되고 새로 제출됩니다.</br> \
                    이와 관련하여 꼭 패치노트를 확인 후 업데이트를 실행해주시길 바랍니다.</br></br>\
                    제거 및 다시 제출될 파일 목록은 다음과 같습니다.</br></br>";
  // const notification = refinedDelList.map(({CommitDate, file1, file2}) => {
  //   return { CommitDate, file1, file2 }
  // });
  delList.map(({CommitDate, file1, file2})=>{
    notification+=`제출일: ${CommitDate.substring(0,10)}</br>`;
    notification+=`${file1}</br>`;
    notification+=`${file2}</br></br>`;
  })               

  if(debug) console.log('notification', notification);
  const board = document.createElement('div');
  board.className = 'BJH_deletion_board';

  const text = document.createElement('p');
  text.innerHTML = notification;

  const deletionList = document.createElement('div');
  deletionList.className = 'BJH_deletion_list';

  const closeButton = document.createElement('span');
  closeButton.classList.add('BJH_deletion_board_close', 'BJH_button');
  closeButton.innerHTML = '&times';
  closeButton.onclick = () => {
    board.style.display = "none";
  }

  const yesButton = createButton('동의 및 실행하겠습니다');
  const selfButton = createButton('직접 변경하겠습니다.')  
  const noButton = createButton('아직 변경하지 않겠습니다.')

  yesButton.onclick = async () =>{
    console.log('clicked onclick');

    
    for(let idx = 0; idx < delList.length; idx++){
      let elem = delList[idx];
      let result1 = await fetch(`https://api.github.com/repos/${hook}/contents/${elem.file1}`, {
          method: 'DELETE',
          body: JSON.stringify({sha: elem.Sha1, message: "백준허브 업데이트"}),
          headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
        })
        .then(res => res.json())
        .then(data => {
          console.log(`data1 ${idx}`, data)
          return data;
        });
      
      let result2 = await fetch(`https://api.github.com/repos/${hook}/contents/${elem.file2}`, {
          method: 'DELETE',
          body: JSON.stringify({sha: elem.Sha2, message: "백준허브 업데이트"}),
          headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
        })
        .then(res => res.json())
        .then(data => {
          console.log(`data2 ${idx}`, data);
          return data;
        });
      
      if(result1 && result2){
        await getStats()
        .then((stats)=>{
          delete stats[elem.key];
          saveStats(stats);
        })
      }
    }
    
    
  };
  selfButton.onclick = async () =>{
    if(confirm("확인을 누르면 앞으로 업데이트 버튼이 표시되지 않습니다.\n진행하시겠습니까?")){
      board.style.display = "none";
      getStats()
      .then((stats)=>{
        // TODO: 1.0.2로 바꿔야함
        stats = {};
        stats.version = '1.0.1';
        stats.submission = {};
        saveStats(stats);
      });
    }
  }

  noButton.onclick = () =>{
    board.style.display = "none";
  }


  deletionList.append(closeButton);
  deletionList.append(text);
  deletionList.append(yesButton);
  deletionList.append(selfButton);
  deletionList.append(noButton);
  board.append(deletionList);




  document.body.appendChild(board);
}

function createButton(text){

  let elem = document.getElementById('BJH_update_element');
  if (elem !== undefined) {
    elem = document.createElement('span');
    elem.id = 'BJH_update_element';
    elem.classList.add('runcode-wrapper__8rXm', 'BJH_button_wrap');
  }

  const button = document.createElement('div');
  button.classList.add('BJH_update', 'BJH_button');
  button.innerHTML = `<u>${text}</u>`;
  elem.append(button);

  return elem;
}