# uploadfile_to_fastdfs
上传文件到fastdfs（文件上传，跨域上传，断点续传）


使用时修改demo.html：


		uploader:'http://11.12.112.228/upload',//fastdfs+nginx的文件上传url
		uploadfirst:'http://11.12.112.228/upload',//fastdfs+nginx的文件上传url
		uploadappend:'http://11.12.112.228/append/',//fastdfs+nginx的文件追加url
		uploadinfo:'http://11.12.112.228/info/',//fastdfs+nginx的文件查询url
		
		
		
		......
		
		
		
   		fileSplitSize:1024*1024, //分段上传时每一段数据的标准大小。


