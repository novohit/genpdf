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

def fetch_talents(token):
    url = f"{base_url}/talents/filters"
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        "filters": {
            "major2Domain": ["集成电路设计与集成系统"]
        },
        "keyword": "",
        "page": 0,
        "size": 10,
        "needAggregations": False
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
    
def fetch_teacher_collaborations(teacher_id, token, isDomestic=False):
    url = f"{base_url}/talents/teacher/cooperation?teacherId={teacher_id}&onlyDomestic=false"
    if isDomestic:
        url = f"{base_url}/talents/teacher/cooperation?teacherId={teacher_id}&onlyDomestic=true"

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

def translate_text(text, token,from_language="en", to_language="zh"):
    url = f"{base_url}/translation/translate"
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    payload = {
        "texts": [text],
        "fromLanguage": from_language,
        "toLanguage": to_language
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        response_data = response.json()
        return response_data.get('data', {}).get('translatedTexts', [text])[0]
    except requests.exceptions.RequestException as e:
        print(f"Error translating text: {e}")
        return text

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

def generate_resume(teacher_data, papers, collaborations=[], domestic_collaborations=[], collaborations_chart=[], domestic_collaborations_chart=[], paper_stream_graph_data=[], index=None):
    # url = "http://172.22.121.63:32301/generate-pdf"
    url = "http://localhost:3000/generate-pdf"
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        "teacherData": teacher_data,
        "papers": papers,
        "collaborations": collaborations,
        "domesticCollaborations": domestic_collaborations,
        "relationshipGraph": collaborations_chart,
        "domesticRelationshipGraph": domestic_collaborations_chart,
        "streamGraphData": paper_stream_graph_data,
        "config": {
            "maxPapers": 1000,
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
        # 构建PDF文件路径，添加序号
        index_str = f"{index:04d}_" if index is not None else ""  # 格式化为3位数，例如：001_
        pdf_path = f"{pdf_save_path}/{index_str}{teacher_name}_papers_{len(papers)}_rank_{ranking}_title_{famous_titles_level}_job_{job_title_level}_resume.pdf"
        
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

def process_single_talent(talent, token, index=None):
    teacher_id = talent.get('teacherId')
    teacher_name = talent.get('derivedTeacherName')
    teacher_omit_description = talent.get('omitDescription')
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
    domestic_collaborations = fetch_teacher_collaborations(teacher_id, token, True)
    collaborations_chart = transform_coauthor_data(collaborations)
    domestic_collaborations_chart = transform_coauthor_data(domestic_collaborations)
    paper_stream_graph = fetch_paper_stream_graph(teacher_id, token)
    paper_stream_graph_data = transform_to_stream_graph_data(paper_stream_graph)
    chineseDescription = translate_text(teacher_omit_description, token)
    talent['chineseDescription'] = chineseDescription
    
    # 创建完整的教师数据
    complete_data = {
        "index": index,  # 添加序号到数据中
        **talent,  # 包含原始教师数据
        "papers": papers,
        "collaborations": collaborations,
        "domestic_collaborations": domestic_collaborations,
        "collaborations_chart": collaborations_chart,
        "domestic_collaborations_chart": domestic_collaborations_chart,
        "paper_stream_graph": paper_stream_graph,
        "paper_stream_graph_data": paper_stream_graph_data
    }
    
    result = generate_resume(talent, papers, collaborations, domestic_collaborations, collaborations_chart, domestic_collaborations_chart, paper_stream_graph_data, index)
    
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

def save_teachers_data_to_json(teachers_data):
    """
    Save all teachers' data to a JSON file.
    
    Args:
        teachers_data (list): List of dictionaries containing teacher data
    """
    json_save_path = os.path.join(os.path.dirname(pdf_save_path), "teachers_data.json")
    
    # Sort teachers by ranking
    sorted_teachers = sorted(teachers_data, key=lambda x: x.get('ranking', float('inf')))
    
    try:
        with open(json_save_path, 'w', encoding='utf-8') as f:
            json.dump(sorted_teachers, f, ensure_ascii=False, indent=2)
        print(f"\n💾 Teachers data saved to: {json_save_path}")
    except Exception as e:
        print(f"\n❌ Error saving teachers data to JSON: {e}")

if __name__ == "__main__":
    os.makedirs(pdf_save_path, exist_ok=True)
    
    start_time = datetime.now()
    token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJsb2dpblR5cGUiOiJsb2dpbiIsImxvZ2luSWQiOjExLCJkZXZpY2UiOiJkZWZhdWx0LWRldmljZSIsImVmZiI6MTc1NDgwOTY5OTA5Miwicm5TdHIiOiJ2aDJzcXFxUWt0bTlGeHlRcWlsQkVkMlZzTm5oVzJxWiJ9.Xsuof96YutUG9bpmhWcPM4zmu10SAf5izZwvHWNcSBY"
    
    print("🔍 Fetching talents list...")
    # talents = load_talents(token)
    # talents = fetch_match_talents(token) # 人才领域
    talents = fetch_talents(token); # 人才发现
    if talents is not None:
        total_talents = len(talents)
        print(f"📋 Found {total_talents} talents to process")
        
        success_count = 0
        failed_count = 0
        
        all_teachers_data = []
        
        # 使用线程池处理简历生成
        max_workers = min(10, total_talents)
        print(f"⚙️ Using {max_workers} threads for processing")
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # 提交所有任务，并传入索引
            future_to_talent = {
                executor.submit(process_single_talent, talent, token, idx + 1): talent
                for idx, talent in enumerate(talents)
            }
            
            # 使用tqdm创建进度条
            with tqdm(total=total_talents, desc="Processing resumes", unit="resume") as pbar:
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
        save_teachers_data_to_json(all_teachers_data)
        
        # 显示最终统计信息
        end_time = datetime.now()
        duration = end_time - start_time
        print("\n📊 Processing Summary:")
        print(f"✅ Successful: {success_count}")
        print(f"❌ Failed: {failed_count}")
        print(f"⏱️ Total time: {duration.total_seconds():.2f} seconds")
        print(f"⚡ Average time per resume: {(duration.total_seconds() / total_talents):.2f} seconds")
