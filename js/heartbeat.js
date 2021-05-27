window.AudioContext = window.AudioContext || window.webkitAudioContext;
var context = null;
var unlocked = false;
var isPlaying = false;  //現在再生中かどうか
var startTime;
var currentNote;  //現在の最後に予定されているメモは何か
var lookahead = 25.0; //スケジューリング関数を呼び出す間隔(ミリ秒)
var scheduleAheadTime = 0.1;  //音をスケジュールする先読み時間の長さ(秒)
                              //先読みから計算され、タイマーが遅れた場合は次の間隔と重複する
var nextNoteTime = 0.0; //次のメモの期限が来たとき
var noteLength = 0.05;  //ビープ音の長さ(秒単位)
var beat = null; //心拍の音を入れる箱


var data = "78,78,77,76,77,75,76,77,77,78,78,79,78,78,76,77,79,80,80,81,80,79,79,77,78,78,77,76,77,90,91,91,89,88,88,87,87,87,87,86,87,87,87,87,87,85,86,87,88,87,86,87,84,82,81,80,80,79,79,81,84,88,90,91,94,98,102,102,105,106,107,104,103,99,94,97,96,97,96,95,95,94,95,96,97,96,95,95,95,95,97,97,98,97,98,100,103,106,111,117,123,128,131,130,129,127,124,118,116,113,116,114,107,107,106,100,97,92,91,89,88,87,88,86,83,82,81,80,78,75,73,71,70,72,69,70,68,69,70,71,71,71,73,73,73,73,75,76,77,80,";
/*var xhr = new XMLHttpRequest(); 
xhr.withCredentials = true;

xhr.open('GET', 'http://192.168.73.170/beat.txt', false);

xhr.onload = function(e) {
  if (xhr.readyState === 4) {
    if (xhr.status === 200) {
      data = xhr.responseText;
      console.log(data)
    }
  }
}
xhr.send(null);*/
const bpms = data.split(',').map( str => parseInt(str, 10));
console.log(bpms[0])


var bpm = bpms[0];
var count = 0;
var timer = null;


function startTimer() {
  timer = setInterval(update, 3000);
}

function stopTimer() {
  clearInterval(timer);
  count = 0;
  bpm = bpms[count];
}

var update = function() {
  console.log(count);
  if(count < bpms.length) {
    ++count;
    console.log("countup");
    if(count == bpms.length) {
      count = 0;
      console.log("countdown");
    }
  }
  console.log(count);
  bpm = bpms[count];
  document.getElementById("bpm").innerHTML = bpm;
};

function nextNote() {
  //現在の音符と時間を次の4分音符に進める
  //nextNoteTime変数とcurrentNote変数の更新
  var bps = 60 / bpm;
  nextNoteTime += bps;  //最後のビート時間に16分音符の長さのビートを追加する　16分音符 = 0.25 8分音符 = 0.5 をbpsとかける
  currentNote++;  //ビート番号を進めてゼロに折り返す
  if (currentNote == 4) {
      currentNote = 0;
  }
}

function scheduleNote( time ) {
  //次に鳴らすべきWebAudioの音をスケジューリングする

  //AudioBufferSourceノードを作成して任意の音をここで設定できる
  var source = context.createBufferSource();
  source.buffer = beat;
  source.connect(context.destination);
  source.start(time); 
}

function scheduler() {
  //オーディオクロックの時間を取得し、次に鳴らすべき音の発音時刻と比較する
  //ほとんどはスケジュールされる音が存在せずに無処理で抜ける
  //存在したらWebAudioAPIを使って次の間隔の前に再生するノートをスケジュールし、ポインターを進める
  //この関数はlookaheadで設定したミリ秒ごとに呼ばれる
  while (nextNoteTime < context.currentTime + scheduleAheadTime ) {
      scheduleNote( nextNoteTime );
      nextNote();
  }
}

function play() {
  if (!unlocked) {
    //サイレントバッファを再生してオーディオのロックを解除します
    var silentBuffer = context.createBuffer(1, 1, 22050);
    var node = context.createBufferSource();
    node.buffer = silentBuffer;
    node.start(0);
    unlocked = true;
  }

  isPlaying = !isPlaying;

  if (isPlaying) { // start playing
    currentNote = 0;
    document.getElementById("bpm").innerHTML = bpm;
    startTimer();
    nextNoteTime = context.currentTime;
    timerWorker.postMessage("start");
    return "stop";
  } 
  else {
    stopTimer();
    document.getElementById("bpm").innerHTML = 0;
    timerWorker.postMessage("stop");
    return "play";
  }
}

var getAudioBuffer = function(url, fn) {  
  var request = new XMLHttpRequest();
  request.responseType = 'arraybuffer';

  request.onreadystatechange = function() {
    if (request.readyState === 4) {
      if (request.status === 0 || request.status === 200) {
        context.decodeAudioData(request.response, function(buffer) {
          fn(buffer);
        });
      }
    }
  };

  request.open('GET', url, true);
  request.send('');
};

function init(){
  context = new AudioContext();

  //オーディオファイルをロード
  getAudioBuffer('./sound/heart.mp3', function(buffer) {
    beat = buffer;
  });

  timerWorker = new Worker("./js/worker.js");

  timerWorker.onmessage = function(e) {
    if (e.data == "tick") {
      // console.log("tick!");
      scheduler();
    }
    else
      console.log("message: " + e.data);
  };
  timerWorker.postMessage({"interval":lookahead});
}

window.addEventListener("load", init );
