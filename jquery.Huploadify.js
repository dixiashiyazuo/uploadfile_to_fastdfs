(function($){
	$.fn.Huploadify = function(opts){
		var itemTemp = '<div id="${fileID}" class="uploadify-queue-item"><div class="uploadify-progress"><div class="uploadify-progress-bar"></div></div><span class="up_filename">${fileName}</span><a href="javascript:void(0);" class="uploadbtn">上传</a><a href="javascript:void(0);" class="stopbtn">暂停</a><a href="javascript:void(0);" class="delfilebtn">删除</a></div>';
		var defaults = {
			count:0,//次数
			appendsuffix:null,//文件追加后缀
			fileTypeExts:'',//允许上传的文件类型，格式'*.jpg;*.doc'
			uploader:'',//文件提交的地址
			uploadfirst:'',//第一次传输的地址
			uploadappend:'',//文件追加的地址前缀
			uploadinfo:'',
			auto:false,//是否开启自动上传
			method:'post',//发送请求的方式，get或post
			multi:true,//是否允许选择多个文件
			formData:null,//发送给服务端的参数，格式：{key1:value1,key2:value2}
			fileObjName:'file',//在后端接受文件的参数名称，如PHP中的$_FILES['file']
			fileSizeLimit:2048,//允许上传的文件大小，单位KB
			showUploadedPercent:true,//是否实时显示上传的百分比，如20%
			showUploadedSize:false,//是否实时显示已上传的文件大小，如1M/2M
			buttonText:'选择文件',//上传按钮上的文字
			removeTimeout: 1000,//上传完成后进度条的消失时间，单位毫秒
			itemTemplate:itemTemp,//上传队列显示的模板
			breakPoints:false,//是否开启断点续传
			fileSplitSize:1024*1024,//断点续传的文件块大小，单位Byte，默认1M
			getUploadedSize:null,//类型：function，自定义获取已上传文件的大小函数，用于开启断点续传模式，可传入一个参数file，即当前上传的文件对象，需返回number类型
			saveUploadedSize:null,//类型：function，自定义保存已上传文件的大小函数，用于开启断点续传模式，可传入两个参数：file：当前上传的文件对象，value：已上传文件的大小，单位Byte
			clearUploadedSize:null,
			onUploadStart:null,//上传开始时的动作
			onUploadSuccess:null,//上传成功的动作
			onUploadComplete:null,//上传完成的动作
			onUploadError:null, //上传失败的动作
			onInit:null,//初始化时的动作
			onCancel:null,//删除掉某个文件后的回调函数，可传入参数file
			onClearQueue:null,//清空上传队列后的回调函数，在调用cancel并传入参数*时触发
			onSelect:null,//选择文件后的回调函数，可传入参数file
			onQueueComplete:null//队列中的所有文件上传完成后触发
		}
			
		var option = $.extend(defaults,opts);

		//定义一个通用函数集合
		var F = {
			//将文件的单位由bytes转换为KB或MB，若第二个参数指定为true，则永远转换为KB
			formatFileSize : function(size,withKB){
				if (size > 1024 * 1024 && !withKB){
					size = (Math.round(size * 100 / (1024 * 1024)) / 100).toString() + 'MB';
				}
				else{
					size = (Math.round(size * 100 / 1024) / 100).toString() + 'KB';
				}
				return size;
			},
			//将输入的文件类型字符串转化为数组,原格式为*.jpg;*.png
			getFileTypes : function(str){
				var result = [];
				var arr1 = str.split(";");
				for(var i=0, len=arr1.length; i<len; i++){
					result.push(arr1[i].split(".").pop());
				}
				return result;
			},
			//根据文件序号获取文件
			getFile : function(index,files){
				for(var i=0;i<files.length;i++){	   
					if(files[i].index == index){
						return files[i];
					}
				}
				return null;
			},
			//根据后缀名获取文件Mime类型
			getMimetype : function(name){
				var mimetypeMap = {
					zip : ['application/x-zip-compressed'],
					jpg : ['image/jpeg'],
					png : ['image/png'],
					gif : ['image/gif'],
					doc : ['application/msword'],
					xls : ['application/msexcel'],
					docx : ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
					xlsx : ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
					ppt : ['application/vnd.ms-powerpoint'],
					pptx : ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
					mp3 : ['audio/mp3'],
					mp4 : ['video/mp4'],
					txt : ['text/plain'],
					pdf : ['application/pdf']
				};
				return mimetypeMap[name];
			},
			getMsgId : function()  
			 {   
			   var id = "";  
			   var codeLength = 6;
			   var selectChar = new Array(0,1,2,3,4,5,6,7,8,9,'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z');     
			   for(var i=0;i<codeLength;i++)  
			   { 
				   var charIndex = Math.floor(Math.random()*36);  
				   id +=selectChar[charIndex];
			   }  
			   return id;
			 },
			//获取上传组件accept的值
			getAcceptString : function(str){
				var types = F.getFileTypes(str);
				console.log("types = " + types);
				var result = [];
				for(var i=0,len=types.length;i<len;i++){
					var mime = F.getMimetype(types[i]);
					if(mime){
						result.push(mime);				
					}
				}
				return result.join(',');
			}
		};

		var returnObj = null;

		this.each(function(index, element){
			var _this = $(element);
			var instanceNumber = $('.uploadify').length+1;
			var uploadManager = {
				container : _this,
				filteredFiles : [],//过滤后的文件数组
				uploadOver : false, //一次上传是否真正结束，用于断点续传的情况
				uploadStopped : true, //上传是否停止
				init : function(){
					//input file  class change
					var inputStr = '<input id="select_btn_'+instanceNumber+'" class="selectbtn" style="display:none;" type="file" name="fileselect[]"';
					inputStr += option.multi ? ' multiple' : '';
					//自定义控件，下面两行
					inputStr += ' accept="';
					inputStr += F.getFileTypes(option.fileTypeExts); // 文件可以多选
					//inputStr += F.getAcceptString(option.fileTypeExts);
					//console.log("mime-the ====" + F.getFileTypes(option.fileTypeExts));
					inputStr += '"/>';
					inputStr += '<a id="file_upload_'+instanceNumber+'-button" href="javascript:void(0)" class="uploadify-button">';
					inputStr += option.buttonText;
					inputStr += '</a>';
					//console.log("instanceNumber ==== " + instanceNumber);
					var uploadFileListStr = '<div id="file_upload_'+instanceNumber+'-queue" class="uploadify-queue"></div>';
					_this.append(inputStr+uploadFileListStr);

					//初始化返回的实例
					returnObj =  {
						instanceNumber : instanceNumber,
						stop : function(){
				  			uploadManager.uploadOver = false;
							uploadManager.uploadStopped = true;
						},
						upload : function(fileIndex){
							if(fileIndex === '*'){
								for(var i=0,len=uploadManager.filteredFiles.length;i<len;i++){
									localStorage.removeItem(uploadManager.filteredFiles[i].name + "_stop");
									uploadManager._uploadFile(uploadManager.filteredFiles[i]);
								}
							}
							else{
								var file = F.getFile(fileIndex,uploadManager.filteredFiles);
								file && uploadManager._uploadFile(file);	
							}
						},
						cancel : function(fileIndex){
							uploadManager.uploadStopped = true;
							uploadManager.uploadOver = true;
							if(fileIndex === '*'){
								var len=uploadManager.filteredFiles.length;
								for(var i=len-1;i>=0;i--){
									uploadManager._deleteFile(uploadManager.filteredFiles[i]);
								}
								option.onClearQueue && option.onClearQueue(len);
							}
							else{
								var file = F.getFile(fileIndex,uploadManager.filteredFiles);
								file && uploadManager._deleteFile(file);
							}
						},
						clearcache : function(fileIndex){
							//console.log("22222222222222222222222222222");
							localStorage.clear();
							option.appendsuffix = null;
							uploadManager.uploadStopped = true;
							uploadManager.uploadOver = true;
							if(fileIndex === '*'){
								var len=uploadManager.filteredFiles.length;
								for(var i=len-1;i>=0;i--){
									uploadManager._deleteFile(uploadManager.filteredFiles[i]);
								}
								uploadManager._getInputBtn().val(''); //清除文件选择框中的已有值
								option.onClearQueue && option.onClearQueue(len);
							}
							else{
								var file = F.getFile(fileIndex,uploadManager.filteredFiles);
								file && uploadManager._deleteFile(file);
							}
							//localStorage.removeItem("c");
						},
						Huploadify : function(){
							var method = arguments[0];
							if(method in this){
								Array.prototype.splice.call(arguments, 0, 1);
								this[method].apply(this[method], arguments);
							}
						}
					};

					//文件选择控件选择
					var fileInput = this._getInputBtn();
				  	if (fileInput.length>0) {
						fileInput.change(function(e) { 
							console.log("选择恐惧症3 e = " + e);
							uploadManager._getFiles(e); 
					 	});	
				 	}
				  
					//点击选择文件按钮时触发file的click事件
					_this.find('.uploadify-button').on('click',function(){
						//console.log("触发选择文件按钮 start");
						_this.find('.selectbtn').trigger('click');
						console.log("触发选择文件按钮 end");
					});
				  
					option.onInit && option.onInit(returnObj);
				},
				_filter: function(files) {		//选择文件组的过滤方法
					var arr = [];
					//console.log("333333333333333");
					var typeArray = F.getFileTypes(option.fileTypeExts);
					if(typeArray.length>0){
						for(var i=0,len=files.length;i<len;i++){
							var f = files[i];
							if(parseInt(F.formatFileSize(f.size,true))<=option.fileSizeLimit){
								if($.inArray('*',typeArray)>=0 || $.inArray(f.name.split('.').pop(),typeArray)>=0){
									arr.push(f);
								}
								else{
									alert('文件 "'+f.name+'" 类型不允许！');
								}
							}
							else{
								alert('文件 "'+f.name+'" 大小超出限制！');
								continue;
							}
						}
					}
					return arr;
				},
				_getInputBtn : function(){
					return _this.find('.selectbtn');
				},
				_getFileList : function(){
					return _this.find('.uploadify-queue');
				},
				//根据选择的文件，渲染DOM节点
				_renderFile : function(file){
					//console.log("select yeah    ========");
					var $html = $(option.itemTemplate.replace(/\${fileID}/g,'fileupload_'+instanceNumber+'_'+file.index).replace(/\${fileName}/g,file.name).replace(/\${fileSize}/g,F.formatFileSize(file.size)).replace(/\${instanceID}/g,_this.attr('id')));
					//如果是非自动上传，显示上传按钮
					//console.log("最开始file.name=========" + file.name);
					if(!option.auto){
						$html.find('.uploadbtn').css('display','inline-block');
					}

					//如果开启断点续传，先初始化原来上传的文件大小
					var initWidth = 0,initFileSize = '0KB',initUppercent = '0%';
					if(option.breakPoints){
						var uploadedSize = option.getUploadedSize(file);
						//console.log("uploadedSize======" + uploadedSize);
						//先设置进度条为原来已上传的文件大小
						//矫正计算误差出现的大于100%问题
						if(uploadedSize >= file.size){
							initWidth = initUppercent = '100%';
							initFileSize = F.formatFileSize(file.size);
							file.status = 2; //上传成功
						}
						else{
							initWidth = (uploadedSize / file.size * 100) + '%';
							initFileSize = F.formatFileSize(uploadedSize);
							initUppercent = (uploadedSize / file.size * 100).toFixed(2) + '%';
						}

						$html.find('.uploadify-progress-bar').css('width',initWidth);
					}

					uploadManager._getFileList().append($html);

					//判断是否显示已上传文件大小
					if(option.showUploadedSize){
						var num = '<span class="progressnum"><span class="uploadedsize">'+initFileSize+'</span>/<span class="totalsize">${fileSize}</span></span>'.replace(/\${fileSize}/g,F.formatFileSize(file.size));
						$html.find('.uploadify-progress').after(num);
					}
					
					//判断是否显示上传百分比	
					if(option.showUploadedPercent){
						var percentText = '<span class="up_percent">'+initUppercent+'</span>';
						$html.find('.uploadify-progress').after(percentText);
					}

					//触发select动作
					option.onSelect && option.onSelect(file);

					//判断是否是自动上传
					if(option.auto){
						uploadManager._uploadFile(file);
					}
					else{
						//如果配置非自动上传，绑定上传事件
					 	$html.find('.uploadbtn').on('click',function(){

					 		if(!$(this).hasClass('disabledbtn')){
					 			//$(this).addClass('disabledbtn');
					 			console.log("start upupupupupup");
					 			localStorage.setItem(file.name + "_stop", "false");
					 			uploadManager._uploadFile(file);
					 		}
				 		});
					}

					//为删除文件按钮绑定删除文件事件
			 		$html.find('.delfilebtn').on('click',function(){
			 			if(!$(this).hasClass('disabledbtn')){
					 		//$(this).addClass('disabledbtn');
			 				uploadManager._deleteFile(file);
			 			}
			 		});
			 		$html.find('.stopbtn').on('click',function(){
			 			if(!$(this).hasClass('disabledbtn')){
					 		//$(this).addClass('disabledbtn');
					 		console.log("stop upupupupupup");
			 				localStorage.setItem(file.name + "_stop", "true");
			 			}
			 		});
				},
				//获取选择后的文件
				_getFiles : function(e){
			  		var files = e.target.files;
			  		//console.log("filecount =999999999999999999");
			  		files = uploadManager._filter(files);
			  		var fileCount = _this.find('.uploadify-queue .uploadify-queue-item').length;//队列中已经有的文件个数
					//console.log("文件个数:filecount = " + fileCount);
		  			for(var i=0,len=files.length;i<len;i++){
		  				//console.log("文件个数:filecount = " + fileCount);
		  				if(uploadManager._checkFile(files[i]))
		  				{
			  				files[i].index = ++fileCount;
			  				files[i].status = 0;//标记为未开始上传
			  				console.log("files[" + i + "].name" + files[i].name);
			  				uploadManager.filteredFiles.push(files[i]);
			  				var l = uploadManager.filteredFiles.length;
			  				console.log("文件个数为 l ======== " + l);
			  				uploadManager._renderFile(uploadManager.filteredFiles[l-1]);
			  			}
		  			}
				},
				//删除文件
				_deleteFile : function(file){
					for (var i = 0,len=uploadManager.filteredFiles.length; i<len; i++) {
						console.log("uploadManager.filteredFiles.length" + uploadManager.filteredFiles.length);
						var f = uploadManager.filteredFiles[i];
						if (f.index == file.index) {
							if(option.breakPoints){
						  		uploadManager.uploadStopped = true;
						  	}
							uploadManager.filteredFiles.splice(i,1);
							_this.find('#fileupload_'+instanceNumber+'_'+file.index).fadeOut();
							option.onCancel && option.onCancel(file);	
							break;
						}
			  		}
				},
				_checkFile : function(file) 
				{
					for (var i = 0,len=uploadManager.filteredFiles.length; i<len; i++) 
					{
						var f = uploadManager.filteredFiles[i];
						if (f.name == file.name) 
						{
							return false; //文件已存在于缓冲区
						}
					}
					return true;
				},
				//校正上传完成后的进度条误差
				_regulateView : function(file){
					var thisfile = _this.find('#fileupload_'+instanceNumber+'_'+file.index);
					thisfile.find('.uploadify-progress-bar').css('width','100%');
					option.showUploadedSize && thisfile.find('.uploadedsize').text(thisfile.find('.totalsize').text());
					option.showUploadedPercent && thisfile.find('.up_percent').text('100%');	
				},

				onProgress : function(filegaoc, originalfile, loaded, total) {
					var eleProgress = _this.find('#fileupload_'+instanceNumber+'_'+originalfile.index+' .uploadify-progress');
					var thisLoaded = loaded;
					//根据上一次触发progress时上传的大小，得到本次的增量
					var lastLoaded = eleProgress.attr('lastLoaded') || 0;
					loaded -= parseInt(lastLoaded);
					var progressBar = eleProgress.children('.uploadify-progress-bar');
					var oldWidth = option.breakPoints ? parseFloat(progressBar.get(0).style.width || 0) : 0;
					var oldProgressNum = eleProgress.nextAll('.progressnum').find('.uploadedsize');
					var oldSize = parseFloat(oldProgressNum.text()) || 0;
					var percent = (loaded / originalfile.size * 100 + oldWidth).toFixed(2);
					var percentText = percent > 100 ? '99.99%' : percent + '%';//校正四舍五入的计算误差
					if(option.showUploadedSize){
						var showloadedsize = option.getUploadedSize(filegaoc);
						oldProgressNum.text(F.formatFileSize(showloadedsize));
						//eleProgress.nextAll('.progressnum .uploadedsize').text(F.formatFileSize(showloadedsize));
					}
					if(option.showUploadedPercent){
						eleProgress.nextAll('.up_percent').text(percentText);	
					}
					//console.log("percentText: " + percentText);
					progressBar.css('width', percentText);//进度条颜色改变

					//记录本次触发progress时已上传的大小，用来计算下次需增加的数量
					if(thisLoaded<option.fileSplitSize){
						eleProgress.attr('lastLoaded',thisLoaded);
					}
					else{
						eleProgress.removeAttr('lastLoaded');	
					}
			  	},
			  	_allFilesUploaded : function(){
		  			var queueData = {
						uploadsSuccessful : 0,
						uploadsErrored : 0
					};
			  		for(var i=0,len=uploadManager.filteredFiles.length; i<len; i++){
			  			var s = uploadManager.filteredFiles[i].status;
			  			if(s===0 || s===1){
			  				queueData = false;
			  				break;
			  			}
			  			else if(s===2){
			  				queueData.uploadsSuccessful++;
			  			}
			  			else if(s===3){
			  				queueData.uploadsErrored++;
			  			}
			  		}
			  		return queueData;
			  	},
		
			  	//上传文件片
			  	_sendgaoc : function(xhr, file, originalfile){
			  		if(file.status===0){
						file.status = 1;//标记为正在上传
						//console.log("originalfile.count =========" + originalfile.count);
						originalfile.count = originalfile.count + 1; //默认值为零
						uploadManager.uploadStopped = false;
						if(localStorage.getItem(file.name + "append"))
						{
							option.appendsuffix = localStorage.getItem(file.name + "append");
							//console.log("option.appendsuffix" + option.appendsuffix);
						}
						console.log("originalfile.count = " + originalfile.count);
						if(originalfile.count === 2)
						{
							console.log("option.appendsuffix222222 ===" + option.appendsuffix);
							if(option.appendsuffix)
							{
								//option.uploader = option.uploadappend + option.appendsuffix;
								localStorage.setItem(file.name + "append", option.appendsuffix);
							}
						};
						//console.log("option.uploader ======" + option.uploader);
						if(localStorage.getItem(file.name + "append") && originalfile.count === 1)
						{
							xhr.open("GET", option.uploadinfo + localStorage.getItem(file.name + "append"), true);
						}
						else
						{
							if(originalfile.count === 1)
							{
								//console.log("111111111111111111 option.uploader = " + option.uploader);
								xhr.open(option.method, option.uploader, true);
							}
							else
							{
								xhr.open(option.method, option.uploadappend + localStorage.getItem(file.name + "append"), true);
							}
						}
						xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
						
						if(originalfile.count != 1)
						{
							xhr.setRequestHeader("Content-Type", "application/octet-stream");
							xhr.send(file=file);
						}
						else
						{
							var fd = new FormData();
							//console.log("originalfile.name=========" + originalfile.name);
							//fd.append("file",file, originalfile.name);
							fd.append(option.fileObjName,file,originalfile.name);
							xhr.send(fd);
						}
					}
			  	},
			  	//上传成功后的回调函数
			  	_uploadSucessCallback : function(file, xhr){
			  		uploadManager._regulateView(file);
					file.status = 2;//标记为上传成功
					console.log("file.name = " + file.name + "," +  localStorage.getItem(file.name + "append"));
					localStorage.removeItem(file.name + "append");
					localStorage.removeItem(file.name + "_notify");
					localStorage.removeItem(file.name + "_stop");
					//console.log("成功了");

					option.onUploadSuccess && option.onUploadSuccess(file, xhr.responseText);
					//在指定的间隔时间后删掉进度条
					setTimeout(function(){
						_this.find('#fileupload_'+instanceNumber+'_'+file.index).fadeOut();
					},option.removeTimeout);
			  	},
				//上传文件
				_uploadFile : function(file){
					var xhr = null;
					var originalFile = file;//保存原始未切割的文件引用
					try{
						xhr=new XMLHttpRequest();
					}catch(e){	  
						xhr=ActiveXobject("Msxml12.XMLHTTP");
				  	}

				  	//判断是否开启断点续传
				  	if(option.breakPoints){
				  		var uploadedSize = 0;
				  		if(option.getUploadedSize){
				  			uploadedSize = option.getUploadedSize(originalFile);
				  			//console.log("uploadedsize" + uploadedSize);
				  		}
				  		else{
				  			alert('请先配置getUploadedSize参数！');
				  			return;
				  		}
						//console.log("uploadedSize =========" + uploadedSize + ",,,,,filename == " + file.name);
				  		file = originalFile.slice(uploadedSize,uploadedSize + option.fileSplitSize);
				  		originalFile.count = 0;
				  		file.status = originalFile.status;
				  		file.name = originalFile.name;
				  	}

				  	if(xhr.upload){
				  		// 上传中
						  	xhr.upload.onprogress = function(e) 
						  	{
						  		if(!(localStorage.getItem(file.name + "_notify")))
				  				{
									uploadManager.onProgress(file, originalFile, e.loaded, e.total);
								}
							};
						//}

						xhr.onreadystatechange = function(e) {
							if(xhr.readyState == 4){
								uploadManager.uploadOver = true;
								if(xhr.status == 200){
									if(option.breakPoints)
									{
										//console.log("UploadedSize ======= " + option.getUploadedSize(originalFile));
										//保存已上传文件大小
										uploadedSize += option.fileSplitSize;
										if(option.saveUploadedSize){
											option.saveUploadedSize(originalFile,uploadedSize);	
										}
										else{
											alert('请先配置saveUploadedSize参数！');
											return;
										}

										//xhr.abort();
										//继续上传其他片段
										if(uploadedSize<originalFile.size)
										{
											if(originalFile.count === 1)
											{
												if(localStorage.getItem(file.name + "append"))
												{
													if(JSON.parse(xhr.responseText).file_size)
													{
														uploadedSize = JSON.parse(xhr.responseText).file_size;
														console.log("uploadedsize append ===" + uploadedSize);
													}
												}
												else
												{
													if(JSON.parse(xhr.responseText).fileid)
													{
														option.appendsuffix = JSON.parse(xhr.responseText).fileid;
														console.log("option.appendsuffix ===" + option.appendsuffix);
													}
												}
											}
											//console.log("uploadedsize original ===" + uploadedSize);
											uploadManager.uploadOver = false;
											if(!uploadManager.uploadStopped){
												file = originalFile.slice(uploadedSize,uploadedSize + option.fileSplitSize);
										  		file.status = originalFile.status;
										  		file.name = originalFile.name;
										  		console.log("yyyyyyyyyyyyyyyyyyyyyyyyyyyy" + localStorage.getItem(file.name + "_stop"));
										  		if(localStorage.getItem(file.name + "_stop") != "true")
										  		{
													uploadManager._sendgaoc(xhr, file, originalFile);
												}
											}
										}
										else
										{
											//originalfile.count = 0;
											if(originalFile.count === 1)
											{
												if(JSON.parse(xhr.responseText).fileid)
												{
													option.appendsuffix = JSON.parse(xhr.responseText).fileid;
													localStorage.setItem(file.name + "append", option.appendsuffix);
													//console.log("option.appendsuffix one times is just ok ===" + option.appendsuffix);
												}
											}
											if(!(localStorage.getItem(file.name + "_notify")))
											{
												uploadManager.uploadOver = false;
												localStorage.setItem(file.name + "_notify", 1);
												xhr.open("POST", "/xdja_api/record/record_file2/add");
												body_string = "f_name=" + originalFile.name + "&f_path=" + localStorage.getItem(file.name + "append");
												//xhr.send("f_name=gggggggggg");
												xhr.send(body_string);
											}
											else
											{
												console.log("xhr.responseText notify = " + xhr.responseText);
												uploadManager._uploadSucessCallback(originalFile, xhr);
											}
										}
									}
									else
									{
										uploadManager._uploadSucessCallback(originalFile, xhr);
									}
								}
								else {
									originalFile.status = 3;//标记为上传失败
									option.onUploadError && option.onUploadError(originalFile, xhr.responseText);
								}

								//无论上传成功或失败均执行下面的代码
								if(uploadManager.uploadOver){
									option.onUploadComplete && option.onUploadComplete(originalFile,xhr.responseText);
									//检测队列中的文件是否全部上传完成，执行onQueueComplete
									if(option.onQueueComplete){
										var queueData = uploadManager._allFilesUploaded();
										queueData && option.onQueueComplete(queueData);	
									}

									//清除文件选择框中的已有值
									uploadManager._getInputBtn().val('');
									originalFile.count = 0;
									option.uploader = option.uploadfirst;
									console.log("end===================end========")
								}
								
							}
						}
					
						//开始上传文件
						option.onUploadStart && option.onUploadStart(originalFile);
						uploadManager._sendgaoc(xhr, file, originalFile);
						
				  	}
				}
			};

			uploadManager.init();
		});
		
		return returnObj;

	}
})(jQuery)