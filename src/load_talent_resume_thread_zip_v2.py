import requests
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
import os
from tqdm import tqdm
from datetime import datetime

#base_url = "http://172.22.121.63:32738/api"
base_url = "http://172.22.121.63:30900/api"
pdf_save_path = "../output/resumes_v1"

def load_talents(token):
    teacher_id_list = []
    with open('talents.json', 'r', encoding='utf-8') as f:
        talents = json.load(f)
        for talent in talents:
            teacher_id_list.append({
                'teacherId': talent.get('teacherId'),
                'index': talent.get('index')
            })

    url = f"{base_url}/talents/teacher/list"
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    payload = teacher_id_list
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        response_data = response.json()

        return response_data.get('data', {})
    except requests.exceptions.RequestException as e:
        print(f"Error making request: {e}")
        return None

def fetch_talents(token, keyword):
    url = f"{base_url}/talents/filters"
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        "filters": {
        },
        "keyword": keyword,
        "page": 0,
        "size": 10,
        "needAggregations": False,
        "onlySearchPerson": True
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        response_data = response.json()

        return response_data.get('data', {}).get('records', [])
    except requests.exceptions.RequestException as e:
        print(f"Error making request: {e}")
        return None

def fetch_match_talents(token):
    url = f"{base_url}/search/match-talents"
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    keyword = "人工智能"

    payload = {
        "task": {
            "sub_tasks": [
                keyword
            ],
            "origin_task": keyword,
            "weights": [
                1
            ]
        },
        "filters": [
            {
                "key": "coauthor_is_chinese",
                "values": [
                    "1"
                ]
            }
        ],
        "limitParams": {
            "limit": 15
        }
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        response_data = response.json()
        talent_extra_infos = [item.get('talentExtraInfo', {}) for item in response_data.get('data', {}).get('list', [])]
        return talent_extra_infos
    except requests.exceptions.RequestException as e:
        print(f"Error making request: {e}")
        return None

def transform_coauthor_data(api_data):
    """
    Transform co-author data from API format to visualization format.
    
    Args:
        api_data (list): List of co-author data from API
        
    Returns:
        list: Transformed data containing top 20 co-authors sorted by cooperation count
    """
    # Sort by number of cooperations in descending order
    sorted_data = sorted(api_data, key=lambda x: x.get('numCooperation', 0), reverse=True)
    
    # Take only top 20 co-authors
    top_coauthors = sorted_data[:20]
    
    # Transform the data format
    transformed_data = [
        {
            'text': item.get('partnerName', ''),
            'id': item.get('partnerId', ''),
            'strength': item.get('numCooperation', 0)
        }
        for item in top_coauthors
    ]
    
    return transformed_data

def transform_to_stream_graph_data(interest_infos):
    """
    Transform interest information into stream graph data format.
    
    Args:
        interest_infos (list): List of interest information containing keyword and year count data
        
    Returns:
        list: Transformed data for stream graph visualization. Returns empty list if input is empty.
    """
    # Return empty list if interest_infos is empty
    if not interest_infos:
        return []

    # Get all unique years from the first interest info's keyword_year_count_info
    years = sorted(set(
        int(item['year']) 
        for item in interest_infos[0]['keyword_year_count_info']
    ))
    
    # Create data points for each year
    return [
        {
            'x': year,
            **{
                info['keyword']: next(
                    (item['count'] for item in info['keyword_year_count_info'] 
                     if int(item['year']) == year),
                    0  # default value if year not found
                )
                for info in interest_infos
            }
        }
        for year in years
    ]

def fetch_teacher_papers(teacher_id, token):
    url = f"{base_url}/papers/{teacher_id}/page"
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        "page": 1,
        "size": 1000
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        response_data = response.json()
        return response_data.get('data', {}).get('list', [])
    except requests.exceptions.RequestException as e:
        print(f"Error fetching papers for teacher {teacher_id}: {e}")
        return []
    
def fetch_teacher_collaborations(teacher_id, token):
    url = f"{base_url}/talents/teacher/cooperation?teacherId={teacher_id}&onlyDomestic=false"
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        response_data = response.json()
        return response_data.get('data', [])
    except requests.exceptions.RequestException as e:
        print(f"Error fetching collaborations for teacher {teacher_id}: {e}")
        return []
    
def fetch_paper_stream_graph(teacher_id, token):
    url = f"{base_url}/talents/paper-stream-graph"
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    payload = {
        "teacherId": teacher_id,
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        response_data = response.json()
        return response_data.get('data', [])
    except requests.exceptions.RequestException as e:
        print(f"Error fetching paper stream graph for teacher {teacher_id}: {e}")
        return []

def generate_resume(teacher_data, papers, collaborations=[], collaborations_chart=[], paper_stream_graph_data=[], index=None, keyword_folder=""):
    url = "http://172.22.121.63:32301/generate-pdf"
    # url = "http://localhost:3000/generate-pdf"
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        "teacherData": teacher_data,
        "papers": papers,
        "collaborations": collaborations,
        "relationshipGraph": collaborations_chart,
        "streamGraphData": paper_stream_graph_data,
        "config": {
            "maxPapers": 10,
                "maxCollaborations": 5,
                "maxMajor2Domain": 10,
                "maxMajor3Domain": 10
        }
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        
        # 获取教师姓名，用于文件名
        teacher_name = teacher_data.get('derivedTeacherName', 'unknown')
        ranking = teacher_data.get('ranking', 'null')
        famous_titles_level = teacher_data.get('famousTitlesLevel', 'null')
        job_title_level = teacher_data.get('jobTitleLevel', 'null')
        # 构建PDF文件路径，添加序号和keyword文件夹
        index_str = f"{index:04d}_" if index is not None else ""  # 格式化为4位数，例如：0001_
        pdf_path = f"{keyword_folder}/{index_str}{teacher_name}_papers_{len(papers)}_rank_{ranking}_resume.pdf"
        
        # 将PDF内容写入文件
        with open(pdf_path, 'wb') as f:
            f.write(response.content)
        
        return {
            "success": True,
            "file_path": pdf_path,
            "message": f"PDF saved successfully at {pdf_path}"
        }
    except requests.exceptions.RequestException as e:
        print(f"Error generating resume: {e}")
        return None
    except IOError as e:
        print(f"Error saving PDF file: {e}")
        return None

def process_single_talent(talent, token, index=None, keyword_folder=""):
    teacher_id = talent.get('teacherId')
    teacher_name = talent.get('derivedTeacherName')
    if not teacher_id:
        return {
            "success": False,
            "teacher_name": teacher_name,
            "message": "No teacher ID found",
            "index": index,
            "complete_data": None
        }
    
    print(f"\nProcessing {teacher_name} (ID: {teacher_id})")
    papers = fetch_teacher_papers(teacher_id, token)
    collaborations = fetch_teacher_collaborations(teacher_id, token)
    collaborations_chart = transform_coauthor_data(collaborations)
    paper_stream_graph = fetch_paper_stream_graph(teacher_id, token)
    paper_stream_graph_data = transform_to_stream_graph_data(paper_stream_graph)
    
    # 创建完整的教师数据
    complete_data = {
        "index": index,  # 添加序号到数据中
        **talent,  # 包含原始教师数据
        "papers": papers,
        "collaborations": collaborations,
        "collaborations_chart": collaborations_chart,
        "paper_stream_graph": paper_stream_graph,
        "paper_stream_graph_data": paper_stream_graph_data
    }
    
    result = generate_resume(talent, papers, collaborations, collaborations_chart, paper_stream_graph_data, index, keyword_folder)
    
    if result is not None:
        complete_data["pdf_path"] = result["file_path"]
        return {
            "success": True,
            "teacher_name": teacher_name,
            "message": result['message'],
            "index": index,
            "complete_data": complete_data
        }
    else:
        return {
            "success": False,
            "teacher_name": teacher_name,
            "message": "Failed to generate resume",
            "index": index,
            "complete_data": None
        }

def save_teachers_data_to_json(teachers_data, keyword):
    """
    Save all teachers' data to a JSON file for a specific keyword.
    
    Args:
        teachers_data (list): List of dictionaries containing teacher data
        keyword (str): The keyword for this batch of data
    """
    # Create keyword-specific folder for JSON data
    keyword_json_folder = os.path.join(os.path.dirname(pdf_save_path), f"{keyword}_data")
    os.makedirs(keyword_json_folder, exist_ok=True)
    
    json_save_path = os.path.join(keyword_json_folder, f"{keyword}_teachers_data.json")
    
    # Sort teachers by ranking
    sorted_teachers = sorted(teachers_data, key=lambda x: x.get('ranking', float('inf')))
    
    try:
        with open(json_save_path, 'w', encoding='utf-8') as f:
            json.dump(sorted_teachers, f, ensure_ascii=False, indent=2)
        print(f"\n💾 Teachers data for '{keyword}' saved to: {json_save_path}")
    except Exception as e:
        print(f"\n❌ Error saving teachers data to JSON for '{keyword}': {e}")

def process_keyword(keyword, token):
    """
    Process a single keyword and generate resumes for all talents found.
    
    Args:
        keyword (str): The keyword to search for
        token (str): Authentication token
        
    Returns:
        dict: Summary statistics for this keyword
    """
    print(f"\n🔍 Processing keyword: '{keyword}'")
    
    # Create keyword-specific folder
    keyword_folder = os.path.join(pdf_save_path, keyword)
    os.makedirs(keyword_folder, exist_ok=True)
    print(f"📁 Created folder: {keyword_folder}")
    
    # Fetch talents for this keyword
    talents = fetch_talents(token, keyword)
    if talents is None or len(talents) == 0:
        print(f"❌ No talents found for keyword: '{keyword}'")
        return {
            "keyword": keyword,
            "total": 0,
            "success": 0,
            "failed": 0,
            "duration": 0
        }
    
    total_talents = len(talents)
    print(f"📋 Found {total_talents} talents for keyword '{keyword}'")
    
    success_count = 0
    failed_count = 0
    all_teachers_data = []
    
    start_time = datetime.now()
    
    # 使用线程池处理简历生成
    max_workers = min(10, total_talents)
    print(f"⚙️ Using {max_workers} threads for processing '{keyword}'")
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # 提交所有任务，并传入索引和keyword文件夹
        future_to_talent = {
            executor.submit(process_single_talent, talent, token, idx + 1, keyword_folder): talent
            for idx, talent in enumerate(talents)
        }
        
        # 使用tqdm创建进度条
        with tqdm(total=total_talents, desc=f"Processing '{keyword}'", unit="resume") as pbar:
            # 处理完成的任务
            for future in as_completed(future_to_talent):
                result = future.result()
                if result["success"]:
                    success_count += 1
                    status = "✅"
                    # 将完整的教师数据添加到列表中
                    if result["complete_data"]:
                        all_teachers_data.append(result["complete_data"])
                else:
                    failed_count += 1
                    status = "❌"
                
                # 更新进度条，显示序号
                pbar.update(1)
                # 显示当前处理的简历状态（包含序号）
                pbar.set_postfix_str(f"{status} [{result['index']:03d}] {result['teacher_name']}")
    
    # 保存所有教师数据到JSON文件
    save_teachers_data_to_json(all_teachers_data, keyword)
    
    # 计算处理时间
    end_time = datetime.now()
    duration = end_time - start_time
    
    print(f"\n📊 Summary for keyword '{keyword}':")
    print(f"✅ Successful: {success_count}")
    print(f"❌ Failed: {failed_count}")
    print(f"⏱️ Total time: {duration.total_seconds():.2f} seconds")
    if total_talents > 0:
        print(f"⚡ Average time per resume: {(duration.total_seconds() / total_talents):.2f} seconds")
    
    return {
        "keyword": keyword,
        "total": total_talents,
        "success": success_count,
        "failed": failed_count,
        "duration": duration.total_seconds()
    }

if __name__ == "__main__":
    os.makedirs(pdf_save_path, exist_ok=True)
    
    start_time = datetime.now()
    token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJsb2dpblR5cGUiOiJsb2dpbiIsImxvZ2luSWQiOjExLCJkZXZpY2UiOiJkZWZhdWx0LWRldmljZSIsImVmZiI6MTc1NDgwOTY5OTA5Miwicm5TdHIiOiJ2aDJzcXFxUWt0bTlGeHlRcWlsQkVkMlZzTm5oVzJxWiJ9.Xsuof96YutUG9bpmhWcPM4zmu10SAf5izZwvHWNcSBY"
    
    # 定义要处理的关键词列表
    keywords = [
    "Ali Ghodsi",
    "Ming-Yu Liu",
    "Mike Houston",
    "Desney Tan",
    "arun sacheti",
    "Jianfeng Gao",
    "Weizhu Chen",
    "Michael Zeng",
    "Hsiao-Wuen Hon",
    "Noam Shazeer",
    "Simon See",
    "Ruofei Zhang",
    "Jinyu Li",
    "Ang Li",
    "Xiaomo Liu",
    "Vincent Vanhoucke",
    "Johnny Chung Li",
    "Haoyi Xiong",
    "Hongxia Jin",
    "Jungwon Lee",
    "Greg Yang",
    "Yuhuai",
    "Jimmy Ba",
    "Jaakko Lehtinen",
    "Ahmed Awadallah",
    "Marcin Junczys-Dowmunt",
    "Yifan Gong",
    "Lei He",
    "Nikhil Rao",
    "Qingwei Lin",
    "Ji Liu",
    "Wofciech Galuba",
    "Yang Liu",
    "Lihong Li",
    "Yuyang Wang",
    "Jianshu Chen",
    "Mohammad Saleh",
    "Ed H Chi",
    "Denny Zhou",
    "Heiga Zen",
    "Andrew M. Dai",
    "Pavlo Molchanov",
    "Stan Birchfield",
    "Animesh Garg",
    "Boris Ginsburg",
    "Mostofa Patwary",
    "Haggai Maron",
    "Yuke Zhu",
    "Tsung-Yi Lin",
    "Zhiding Yu",
    "Daguang Xu",
    "Dean Huang",
    "Peng Xu",
    "Sifei Liu",
    "王廷俊",
    "Jason Li",
    "Zihan Liu",
    "Xue Bin Peng",
    "Dong Yang",
    "Kamyar Azizzadenesheli",
    "Jonghyun Kim",
    "Michel Galley",
    "Bhaskar Mitra",
    "Janardhan",
    "Nikos Karampatziakis",
    "Navin Goyal",
    "Zicheng Liu",
    "Ce Liu",
    "Lijuan Wang",
    "Jianwei Yang",
    "Jiang Bian",
    "Jianfeng Wang",
    "Han Hu",
    "Baolin Peng",
    "Fan Yang",
    "Yingce Xia",
    "Cuiling Lan",
    "Lei Cui",
    "Yeyun Gong",
    "Dongdong Zhang",
    "Pengcheng He",
    "Zhengyuan Yang",
    "Kevin Lin",
    "Xiyang Dai",
    "Irene Y.Zhang",
    "Yeye He",
    "Yumao Lu",
    "Han Cai",
    "R Devon Hjelm",
    "zhegan",
    "jiatao gu",
    "yizhe Zhang",
    "yinfei yang",
    "Nan Du",
    "liang chieh chen",
    "Jiahui Yu",
    "Yinbo Zhou",
    "Linjun Yang",
    "Bo Long",
    "RahulSukthankar",
    "Dekang Lin",
    "LiErran Li",
    "Zhiting Hu",
    "XinLi",
    "Pichao Wang",
    "Sungjin",
    "Wentao Zhu",
    "Hsiang FuYu",
    "Peng Dai",
    "Yi Zhu",
    "Jiong Zhang",
    "Chenwei Zhang",
    "XuZhang",
    "Yingpeng Chen",
    "Mar Gonzalez Franco",
    "JaschaSohl-Dickstein",
    "H BrendanMcMahan",
    "kiyuksohn",
    "been kin",
    "khe chai sim",
    "krzysztof choromna siki",
    "ellie pavlick",
    "michael rubinstein",
    "Thang luong",
    "justin gilmer",
    "joel veness",
    "Andreas veit",
    "Vincent dumoulin",
    "mark sandler",
    "LoicMathey",
    "SwaroopMishra",
    "Quoc V Le",
    "Ming-Wei Chang",
    "Deqing Sun",
    "Cong Yu",
    "Liangliang Cao",
    "Han Zhang",
    "shixiang shane Gu",
    "Xinyun Chen",
    "Jonathan Chung-kuan Huang",
    "HanjunDai",
    "chun-Liang Li",
    "Felix Xinnan Yu",
    "Kenton Lee",
    "Xuezhi Wang",
    "Mingxing Tan",
    "Yinda Zhang",
    "Simon Tong",
    "Fangyu Liu",
    "Zheng Xu",
    "Yin Cui",
    "Chiyuan Zhang",
    "Adams Wei Yu",
    "Heng-Tze Cheng",
    "Chong You",
    "Zhen Qin",
    "Luowei Zhou",
    "chen-yu Lee",
    "Zirui Wang",
    "Hongrac Lee",
    "NiLao",
    "Tingnan Zhang",
    "tianhe Yu",
    "SiyuanQiao",
    "Danijar Hafner",
    "Seungjun Nah",
    "Enze Xie",
    "MattPost",
    "JianminBao",
    "Yuxiong He",
    "Yelong Shen",
    "yang Liu",
    "YuWu",
    "Mengchen Liu",
    "QiDai",
    "XiYang",
    "Lijun Wu",
    "Baoguang",
    "jindong Wang",
    "KaiShi",
    "Mathias Muller",
    "xiujun Li",
    "Jordi Pont Tuset",
    "Peter Anderson",
    "xin Luna Dong",
    "Cao Danica Xiao",
    "Yi Zhang",
    "Orhan Firat",
    "Jie Tan",
    "Lei Shu",
    "Tong Sun",
    "Hanxiao Liu",
    "Sebastian Nowozin",
    "Srinadh Bhojanapal",
    "Hanie Sedghi",
    "Tsendsuren Munkhdalai",
    "Johnny Hartz Seraker",
    "Nandita Dukkipati",
    "Boqing Gong",
    "Bo Li",
    "Bo Dai",
    "Fei Xia",
    "Honglei Zhuang",
    "Carrie J.Cai",
    "Yong Cheng",
    "Jianmo Ni",
    "Biao Zhang",
    "Joonseok Lee",
    "Ruoming Pang",
    "Chen Huang",
    "Rongjian Li",
    "Aston Zhang",
    "Zeyuan Allen-Zhu",
    "Todor Mihaylov",
    "Tao Xiang",
    "Xinlei Chen",
    "Juan Pino",
    "Pengchuan Zhang",
    "Xian Li",
    "Licheng Yu",
    "Hu Xu",
    "Haoqi Fan",
    "Sida I.Wang",
    "Dilin Wang",
    "Shen Li",
    "Bernie Huang",
    "Yuning Mao",
    "Xiaoliang Dai",
    "Weipeng Xu",
    "Zhong Meng",
    "Wei Wen",
    "Mei Chen",
    "Xiaodong Cui",
    "Shuo Yang",
    "Pinyu Chen",
    "Daniel Keysers",
    "Neal Wadhwa",
    "Rajarishi Sinha",
    "Sebastian Krause",
    "Zhifeng Chen",
    "Jilin Chen",
    "Zizhao Zhang",
    "Qiao Liang",
    "Dacheng Juan",
    "Yang Liu",
    "Le Hou",
    "Vivek Pai",
    "Xiaodan Song",
    "Wei-Sheng Lai",
    "Yukun Zhu",
    "Pi-Chuan Chang",
    "Shuang Song",
    "Zhuyun Dai",
    "Xiaohua Zhai",
    "Qi Qian",
    "Lu Jiang",
    "Jason Wei",
    "Xin Hu",
    "H.Francis Song",
    "Yang Song",
    "Shiqiang Wang",
    "Yuandong Tian",
    "Payel Das",
    "Matt Uyttendaele",
    "Gedas Bertasius",
    "Yuxiao Dong",
    "Yanghao Li",
    "Bichen Wu",
    "Samuel Thomas",
    "Danish Contractor",
    "Jianying Hu",
    "Kangguo Cheng",
    "Jiaolong Yang",
    "Yang Zhang",
    "Songtao Lu",
    "Rui Li",
    "Jie Chen",
    "Xuedong Huang",
    "Wan-Chun Alex Ma",
    "Jason Phang",
    "Xin Wang",
    "Ian Osband",
    "Yu Zhang",
    "Shibani Santurkar",
    "Yilin Shen",
    "Rameswar Panda",
    "Bin Xiao",
    "Jonathan Chang",
    "Changhan Wang",
    "Kavitha Srinivas",
    "Wael Harnza",
    "Vijil Chenthamarakshan",
    "Quanfu Fan",
    "Shiwan Zhao",
    "Sheng Zhang",
    "Zenxiang Xu",
    "Walter Chang",
    "Yang Zhao",
    "Handong Zhao",
    "Bill",
    "Anbang Yao",
    "Zihang Dai",
    "Chunyuan Li",
    "Ting Chen",
    "Xiao Sun",
    "Hexiang",
    "Ziniu Hu",
    "Rui Hou",
    "Zhewei Yao",
    "Zhongqiang Huang",
    "Alexander A.Alemi",
    "Sheng Shen",
    "Ming Gong",
    "Liang Gou",
    "Toshiaki Koike-Akino",
    "Yao Hu",
    "Alice Wang",
    "Jiantao Jiao",
    "Chenguang Zhu",
    "Dinghan Shen",
    "Devi Parikh",
    "Jian Ren"
]
    
    print(f"🚀 Starting processing for {len(keywords)} keywords")
    print(f"📝 Keywords: {', '.join(keywords)}")
    
    all_summaries = []
    total_success = 0
    total_failed = 0
    total_talents = 0
    
    # 循环处理每个关键词
    for i, keyword in enumerate(keywords, 1):
        print(f"\n{'='*60}")
        print(f"📌 Processing keyword {i}/{len(keywords)}: '{keyword}'")
        print(f"{'='*60}")
        
        summary = process_keyword(keyword, token)
        all_summaries.append(summary)
        
        total_success += summary["success"]
        total_failed += summary["failed"]
        total_talents += summary["total"]
    
    # 显示总体统计信息
    end_time = datetime.now()
    total_duration = end_time - start_time
    
    print(f"\n{'='*60}")
    print("📊 OVERALL PROCESSING SUMMARY")
    print(f"{'='*60}")
    print(f"🎯 Total keywords processed: {len(keywords)}")
    print(f"📋 Total talents found: {total_talents}")
    print(f"✅ Total successful: {total_success}")
    print(f"❌ Total failed: {total_failed}")
    print(f"⏱️ Total processing time: {total_duration.total_seconds():.2f} seconds")
    if total_talents > 0:
        print(f"⚡ Average time per resume: {(total_duration.total_seconds() / total_talents):.2f} seconds")
    
    print(f"\n📈 PER-KEYWORD BREAKDOWN:")
    for summary in all_summaries:
        print(f"  • {summary['keyword']}: {summary['success']}/{summary['total']} successful ({summary['duration']:.2f}s)")
    
    print(f"\n🎉 All processing completed! Check the output folders for results.")
