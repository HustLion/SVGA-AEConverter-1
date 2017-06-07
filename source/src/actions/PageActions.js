var csInterface = new CSInterface();
var nodePath = require("path");
var fs = require('fs');
var spawn = require("child_process");

var outPutPath;
var inputPath;

var player;
var parser;

var workPath;

var CURRENT_PROJECT_PATH = csInterface.getSystemPath(SystemPath.APPLICATION);

// 关闭窗口的时候关闭服务器
window.onunload = function()
{
    // 删除临时文件目录
    deleteFlider(workPath, true, function () {});
}

function selectPath() {

    csInterface.evalScript("searchCompositionDestination()", function (result) {

        if (result != 'undefined'){
            outPutPath = result;

            var startConvertBtn = document.getElementById("startConvertBtn");
            startConvertBtn.disabled = false;
        }
    });
}

function startConvert() {

    if(outPutPath == null || outPutPath == undefined || outPutPath == ''){
        alert("请先选择输出路径...");

    }else {
        var startConvertBtn = document.getElementById("startConvertBtn");
        startConvertBtn.disabled = true;

        csInterface.evalScript("startConvert('"+outPutPath +"');", function (result) {

            var imagePath = result;
            workPath = result;

            //获取图片资源列表
            csInterface.evalScript("getImageList();", function (result) {
                var imageList = JSON.parse(result);

                copyToZip(imagePath, imageList);
            });
        });
    }
}

function selectFile() {

    csInterface.evalScript("browseFolder()", function (result) {

        if (result != 'undefined'){
            inputPath = result;

            preview(result);
        }
    });
}

function preview(filePath) {

    var fileName = filePath;

    var file = window.cep.fs.readFile(fileName, "Base64");

    parser.load("data:image/svga;base64," + file.data, function (videoItem) {

        previewWithVideoItems(videoItem);

    });
}

function previewWithVideoItems(videoItem) {
    var scale = 1;
    var moveX = 0;
    var moveY = 0;

    if (videoItem.videoSize.width > videoItem.videoSize.height){

        scale = (videoItem.videoSize.height / videoItem.videoSize.width);
        moveY = ((400 - 400 * scale)) / 2;

    }else{

        scale = (videoItem.videoSize.width / videoItem.videoSize.height);
        moveX = ((400 - 400 * scale)) / 2;
    }

    player.setVideoItem(videoItem);
    player._stageLayer.setTransform(moveX, moveY, scale, scale);

    player.startAnimation();
}

function copyToZip(zipPath, imageList) {
    var zip = new JSZip();

    // 判断是否有图片
    if (imageList.length){

        stepToZip(zip, 0, imageList, zipPath);
    }else{

        // 没有图片
        var movin = window.cep.fs.readFile(zipPath + '/movie.spec', 'Base64');

        var movinUTF8 = cep.encoding.convertion.b64_to_utf8(movin.data);

        zip.file("movie.spec", movinUTF8);

        zip.generateAsync({type:"Base64"})
            .then(function(content) {
                window.cep.fs.writeFile (outPutPath, content, "Base64");

                alert("xxxx" + workPath);
                // 删除临时文件目录
                deleteFlider(workPath, true, function () {});

                preview(outPutPath);
                outPutPath = undefined;
            });

    }
}

function stepToZip(zip, currentIndex, imageList, zipPath, callback) {

    var  imageName = imageList[currentIndex].toString();
    var imagePath = nodePath.join(zipPath, imageName);

    var pngquantAndZip = function (imagePath) {

        pngquantImage(imagePath, imagePath, function () {

            waitForFileIfExist(imagePath, function () {

                fs.readFile(imagePath, 'Base64', function (err, data) {

                    zip.file(imageName, data, {base64: true});

                    if (currentIndex == imageList.length - 1){

                        var movin = window.cep.fs.readFile(zipPath + '/movie.spec', 'Base64');

                        var movinUTF8 = cep.encoding.convertion.b64_to_utf8(movin.data);

                        zip.file("movie.spec", movinUTF8);

                        zip.generateAsync({type:"Base64"})
                            .then(function(content) {
                                window.cep.fs.writeFile (outPutPath, content, "Base64");

                                preview(outPutPath);
                                outPutPath = undefined;
                            });

                    }else {
                        stepToZip(zip, ++currentIndex, imageList, zipPath);
                    }
                });
            });
        });
    };

    // 判断照片中是否有 jpg 图片
    if (imageName.split('.').pop() == 'jpg'){

        convertJPGToPNG(imagePath, null, pngquantAndZip(imagePath));

    }else if (imageName.split('.').pop() == 'png'){

        pngquantAndZip(imagePath);
    }
}

function deleteFlider(path, isFirstFolder, callback) {

    if(fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file) {

            var curPath = nodePath.join(path, file);
            if(fs.statSync(curPath).isDirectory()) { // recurse
                deleteFlider(curPath, false);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
    if (isFirstFolder){
        callback();
    }
}

function waitForFileIfExist(filePath, callback) {

    // 判断是否有这个文件
    fs.exists(filePath, function(exists) {
        if (exists){
            callback();
        }else{
            // 如果没有 500 ms 后重新查看
            setTimeout("waitForFileIfExist(filePath, callback)", 500);
        }
    });
}

function convertJPGToPNG(imageInputPath, imageOutputPath, callback) {

    var img = new Image();
    img.onload = function () {

        var canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d").drawImage(img, 0, 0);

        if (imageOutputPath == null){

            callback(canvas.toDataURL("image/png").split(',').pop(), nodePath.basename(result, '.jpg'));

        }else{
            fs.writeFile(imageOutputPath, canvas.toDataURL("image/png").split(',').pop(), "Base64", function (err) {
                callback(imageOutputPath);
            });
        }
    };
    img.src = imageInputPath;

}

function pngquantImage(inImgPath, outImgPath, callback) {

    var program;

    // 判断当前系统
    var OSVersion = csInterface.getOSInformation();
    if (OSVersion.indexOf("Windows") >= 0) {

        program = nodePath.join(CURRENT_PROJECT_PATH, 'pngquant', 'WINDOWS', 'pngquant.exe');
        program = '\"' + program + '\"';

    } else if (OSVersion.indexOf("Mac") >= 0) {

        program = nodePath.join(CURRENT_PROJECT_PATH, 'pngquant', 'OSX', 'pngquant').replace('Application ', 'Application\\ ');
    }

    var args = [

        '--quality=0-100',
        '--speed 2',
        inImgPath,
        '--output',
        outImgPath,
        '--force'
    ];

    spawn.exec(program + ' ' + args.join(' '), function () {
        callback();
    });
}