
var ser = [];
var col = 0;
var choiceContainer;
var files_loaded = 0;
var pollRate = 20; //poll for file changes every 20 seconds
var interval_counter;
var file_handles = [];
var updated_files = [];
var selected_files = [];
let reader = new FileReader();
let file_update_reader = new FileReader();
var busy = false;
var first = true;


async function accessFiles() {
    //const pickerOpts = {
    //	multiple: true
    //}

    file_handles = await window.showOpenFilePicker({ multiple: true });

    for (let k = 0; k < file_handles.length; k++) {
        if (file_handles[k]) {
            let f = await file_handles[k].getFile();
            if (!f) { console.log('failed accessing file'); return; }
            selected_files.push({ handle: file_handles[k], file: f });
        }
        else {
            console.log('no file selected');
        }
    }
    reader.readAsText(selected_files[files_loaded].file);
}

function startWatching() {
    if (interval_counter) { clearInterval(interval_counter); }
    interval_counter = setInterval(async ts => {
      checkFiles();
    }, pollRate * 1000);
}

async function checkFiles() {
    if (!selected_files) { return; }
    
    for(let p = 0;p<selected_files.length;p++){
        let f = await selected_files[p].handle.getFile(); //get the latest version of the file from the file handle
        if (f.lastModified > selected_files[p].file.lastModified) {
            console.log(selected_files[p].file.name, 'was updated');
            
            if(first) {
                first=false;
                selected_files[p].file = f;  //update selected files with the newest file
                file_update_reader.file = f;  //give the file reader the file as an attribute
                file_update_reader.filenumber = p; //give the file read the file index (in selected files) as an attribute.
                file_update_reader.readAsText(f);  
            }
        }
    }
}

reader.onload = function () {

    var name = selected_files[files_loaded].file.name;

    var html_string = "<br/><input type='checkbox' name='" + files_loaded +
        "' checked='checked' id='id" + files_loaded + "'></input>" +
        "<label for='id" + files_loaded + "'>"
        + name + "</label>";

    choiceContainer.append(html_string);
    choiceContainer.find("input").on("click", showData); //add event for displaying data when checkbox status changes
    parseFile(reader.result, name,files_loaded);
    files_loaded++;
}

reader.onloadend = function(){
    //check if there are more files to read, if there are, then read the next file now
    if (files_loaded < file_handles.length) {
        reader.readAsText(selected_files[files_loaded].file);
    }
    else{startWatching();}
}
reader.onerror = function () {
    console.log(reader.error);
}

file_update_reader.onload = function(){
    var file_to_update = this.file.name;
    var fn = this.filenumber;
    parseFile(file_update_reader.result, file_to_update,fn);

}
file_update_reader.onloadend = function(){
    //we have finish checking the previous file for an update ... see if there are any more updates
    if(selected_files) {
        checkFiles();
        first = true;
    }
}

file_update_reader.onerror = function () {
    console.log(file_update_reader.error);
}

function choiceObj(ch_container){
    choiceContainer = ch_container;     
}

function parseFile(string_data,series_name,series_number){
    var x_data_ = [];
    var y_data_ = [];
    //console.log(string_data);
    const lines = string_data.split("\n");

    for(let i = 0; i < lines.length; i++){
        if(lines[i].includes(",")){  //the line must contain a comma to have a chance of valid data being present.  If there's no comma just do nothing
             
             const collumns = lines[i].split(",");
             var converted_date;
             if(collumns[2].includes(":")) converted_date = convertDate(collumns[2]);
             else converted_date = convertDate(collumns[1]);
             x_data_.push(converted_date);
             y_data_.push(collumns[0]);
        }
    }
    x_data_.forEach(datestoEpoch_ms)

    addSeries(x_data_,y_data_,series_name,series_number);
    showData();
}

function addSeries(x_data_,y_data_,name,series_number) {
    
    let d = [[]];
    //produce the data from the parsed arrays
    for(let i = 0; i < x_data_.length;i++){
        let k = [x_data_[i],y_data_[i]];
        d.push(k);
    }

    // hard-code color indices to prevent them from shifting as
    // countries are turned on/off

    let s = {
        color: col, 
        label: name,
        data: d 
    };
    
    //check if any element in the the series array already exists i.e is the name the same
    let found = 0;
    let colors = [];
    let color_found=false;
    let first_color_found = false;
    let color_index = 0;

    for(let i = 0;i<ser.length;i++){
        if((ser[i].label == name)&&(series_number==i)){  //we have found an existing series, update the data without changing the colour
            found = true;
            s.color = ser[i].color;  //don't change the color from what is was
            ser[i] = s; //replace the old data with the new
        }
        else if((ser[i].label == name)&&(series_number!=i)){ //we have loaded additional data which is the same name as a previous series... make sure the colours are the same
            
            if(!first_color_found){
                first_color_found=true;
                color_found = ser[i].color;
            }
            colors[color_index]=i;
            color_index++;   
        }
    }
    
    if(!found){
        col++;       //add a new color for the new series.
        ser.push(s); //push a new series onto the array.

        for(let j=0;j<colors.length;j++){
            ser[colors[j]].color=color_found;
            ser[ser.length-1].color = color_found;
        }
        
    }
}



function datestoEpoch_ms(single_date,date_index,date_array){

    date_array[date_index] = Date.parse(single_date);
    //console.log(date_array[date_index]);
}

//epoch time in NZ time is 1 January 1970 at 12:00 (noon)
function convertDate(single_date){
    
    var month_strings = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    
    //date needs to be converted to the form '01 Jan 1970 00:00:00 GMT' 
    if(single_date.includes("a")||single_date.includes("p")){
        //date is of the form 16/10/2022 11:13:46 am
        var date_time = single_date.split(" ");

        //humidity and pressure files have a space before the date string
        if(date_time[0]=="") date_time.shift();

        var date = date_time[0];
        var split_date = date.split("/");
        

        var time = date_time[1];
        var split_time = time.split(":")
        
        var formatted_date = split_date[0] + " " + month_strings[+split_date[1]] + " " + split_date[2] + " ";
        var formatted_time = "";
        if (single_date.includes("p")&&(split_time[0]!=12)){
            formatted_time = (+split_time[0]+12) + ":" + split_time[1] + ":" + split_time[2] + " GMT";                         
        }
        else if (single_date.includes("a")&&(split_time[0]==12)){
            formatted_time = "00:" + split_time[1] + ":" + split_time[2] + " GMT";                         
        }
        else formatted_time = split_time[0] + ":" + split_time[1] + ":" + split_time[2] + " GMT";
        //console.log(formatted_date + formatted_time);
        return formatted_date + formatted_time;

    }
    else if(single_date.includes(":") && !(single_date.includes("a")||single_date.includes("p"))){
        //this date is of the form 16/10/2022 23:13:46
        var date_time = single_date.split(" ");
        //humidity and pressure files have a space before the date string
        if(date_time[0]=="") date_time.shift();
        var date = date_time[0];
        var split_date = date.split("/");
        
        var time = date_time[1];
        var split_time = time.split(":")

        var formatted_date = split_date[0] + " " + month_strings[+split_date[1]] + " " + split_date[2] + " ";
        var formatted_time = formatted_time = split_time[0] + ":" + split_time[1] + ":" + split_time[2] + " GMT";
        return formatted_date + formatted_time;
    }


}




function showData() {
    
    //var data = [];
    var selected_series = [];
    choiceContainer.find("input:checked").each(function () {
        var key = $(this).attr("name");
        selected_series.push(ser[key]);
    });

    var options = {
        legend: {
            show: true
        },
        xaxis: {
            mode: "time",
            timeformat: '%Y-%m-%d %H:%M',
            timeBase: "hours",
            tickLength: 5,
            gridLines: false
        },
        selection: {
            mode: "x"
        },
        grid: {
            
        }

        
    };

    var plot = $.plot("#placeholder", selected_series, options);

    var overview = $.plot("#overview", selected_series, {
        series: {
            lines: {
                show: true,
                lineWidth: 1
            },
            shadowSize: 0
        },
        xaxis: {
            ticks: [],
            mode: "time"
        },
        yaxis: {
            ticks: [],
            min: 0,
            autoScaleMargin: 0.1
        },
        selection: {
            mode: "x"
        }
    });

    // now connect the two

    $("#placeholder").bind("plotselected", function (event, ranges) {

        // do the zooming
        $.each(plot.getXAxes(), function(_, axis) {
            var opts = axis.options;
            opts.min = ranges.xaxis.from;
            opts.max = ranges.xaxis.to;
        });
        plot.setupGrid();
        plot.draw();
        plot.clearSelection();

        // don't fire event on the overview to prevent eternal loop

        overview.setSelection(ranges, true);
    });

    $("#overview").bind("plotselected", function (event, ranges) {
        plot.setSelection(ranges);
    });

    // Add the Flot version string to the footer
    //$("#footer").prepend("Flot " + $.plot.version + " &ndash; ");
}

