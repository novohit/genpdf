import requests
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
import os
from tqdm import tqdm
from datetime import datetime
import pandas as pd
#base_url = "http://172.22.121.63:32738/api"
base_url = "http://172.22.121.63:30900/api"
pdf_save_path = "../output/resumes_v1"

def load_talents(token):
    teacher_id_list = []
    
    # 从Excel文件读取teacherId
    try:
        # 读取Excel文件
        df = pd.read_excel('../人工智能PDF_teacher_id.xlsx')
        
        # 获取第一列数据（包含teacherId）
        teacher_ids = df.iloc[:, 0].dropna()  # 删除空值
        
        # 构建teacher_id_list，index为顺序号
        for idx, teacher_id in enumerate(teacher_ids, 1):
            teacher_id_list.append({
                'teacherId': str(teacher_id),  # 确保teacherId是字符串
                'index': idx  # 使用顺序号作为index
            })
        
        print(f"📋 从Excel文件读取到 {len(teacher_id_list)} 个teacherId")
        
    except Exception as e:
        print(f"❌ 读取Excel文件时出错: {e}")
        return None

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
            "major2Domain": ["集成电路设计与集成系统"],
            "isChinese": [1]
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
    # 如果text为空或None，直接返回原文本
    if not text:
        return text
    
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
        # 安全地获取翻译结果
        translated_texts = response_data.get('data', {}).get('translatedTexts', [])
        if translated_texts and len(translated_texts) > 0:
            return translated_texts[0]
        else:
            return text
    except requests.exceptions.RequestException as e:
        print(f"Error translating text: {e}")
        return text
    except (KeyError, TypeError, IndexError) as e:
        print(f"Error parsing translation response: {e}")
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

def normalize_ranking(ranking):
    """
    将ranking值标准化为可比较的数值
    
    Args:
        ranking: 可能是数字、字符串（如'151-200'）或None
    
    Returns:
        float: 标准化后的数值，用于排序
    """
    if ranking is None:
        return float('inf')
    
    if isinstance(ranking, (int, float)):
        return float(ranking)
    
    # 处理范围形式的排名（如'151-200'）
    if isinstance(ranking, str):
        try:
            if '-' in ranking:
                # 使用范围的第一个数字
                return float(ranking.split('-')[0])
            else:
                return float(ranking)
        except (ValueError, IndexError):
            return float('inf')
    
    return float('inf')

def format_education(educations):
    """格式化教育经历"""
    if not educations:
        return ""
    edu_list = []
    for edu in educations:
        if not edu:
            continue
        parts = []
        if edu.get('endDate'):
            parts.append(f"毕业时间：{edu.get('endDate')}")
        if edu.get('organization'):
            parts.append(f"院校：{edu.get('organization')}")
        if edu.get('department'):
            parts.append(f"院系：{edu.get('department')}")
        if edu.get('degree'):
            parts.append(f"学位：{edu.get('degree')}")
        if parts:
            edu_list.append('，'.join(parts))
    return '\n'.join(edu_list)

def format_employment(employments):
    """格式化工作经历"""
    if not employments:
        return ""
    emp_list = []
    for emp in employments:
        if not emp:
            continue
        parts = []
        if emp.get('startDate'):
            parts.append(f"起始：{emp.get('startDate')}")
        if emp.get('endDate'):
            parts.append(f"结束：{emp.get('endDate')}")
        if emp.get('organization'):
            parts.append(f"单位：{emp.get('organization')}")
        if emp.get('roleTitle'):
            parts.append(f"职位：{emp.get('roleTitle')}")
        if parts:
            emp_list.append('，'.join(parts))
    return '\n'.join(emp_list)

def format_domains(domains):
    """格式化学科领域"""
    if not domains:
        return ""
    return '，'.join(domains)

def save_teachers_data(teachers_data):
    """
    Save all teachers' data to both JSON and Excel files.
    
    Args:
        teachers_data (list): List of dictionaries containing teacher data
    """
    if not teachers_data:
        print("\n❌ No teacher data to save")
        return
        
    # 确保输出目录存在
    output_dir = os.path.dirname(pdf_save_path)
    
    # 保存JSON文件
    json_save_path = os.path.join(output_dir, "teachers_data.json")
    excel_save_path = os.path.join(output_dir, "teachers_data.xlsx")
    
    # 按ranking排序教师数据，使用标准化的ranking值
    sorted_teachers = sorted(teachers_data, key=lambda x: normalize_ranking(x.get('ranking')))
    
    try:
        # 保存JSON文件
        with open(json_save_path, 'w', encoding='utf-8') as f:
            json.dump(sorted_teachers, f, ensure_ascii=False, indent=2)
        print(f"\n💾 Teachers data saved to: {json_save_path}")
        
        # 准备Excel数据
        teacher_info = []
        
        for teacher in sorted_teachers:
            if not teacher:
                continue
                
            teacher_name = teacher.get('derivedTeacherName', '')
            
            # 整合所有信息
            teacher_info.append({
                '序号': teacher.get('index'),
                '姓名': teacher_name,
                '排名': teacher.get('ranking'),
                '论文数量': len(teacher.get('papers', []) or []),
                '职称': teacher.get('normalizedTitle'),
                '职称等级': teacher.get('jobTitleLevel'),
                '头衔': teacher.get('famousTitles'),
                '头衔等级': teacher.get('famousTitlesLevel'),
                '所属机构': teacher.get('schoolName'),
                '所属机构(英文)': teacher.get('schoolNameEn'),
                '学院': teacher.get('collegeName'),
                '地区': teacher.get('region'),
                '邮箱': teacher.get('email'),
                '年龄范围': teacher.get('ageRange'),
                '企业经验': teacher.get('corporateExperience'),
                '海外经验': teacher.get('overseasExperience'),
                '是否博士': '是' if teacher.get('isPhd') == 1 else '否',
                '是否中国籍': '是' if teacher.get('isChinese') == 1 else '否',
                '教育经历': format_education(teacher.get('educations')),
                '工作经历': format_employment(teacher.get('employments')),
                '一级学科(主要)': format_domains(teacher.get('majorPaper1Domain')),
                '一级学科(次要)': format_domains(teacher.get('minorPaper1Domain')),
                '二级学科(主要)': format_domains(teacher.get('majorPaper2Domain')),
                '二级学科(次要)': format_domains(teacher.get('minorPaper2Domain')),
                '三级学科(主要)': format_domains(teacher.get('majorPaper3Domain')),
                '三级学科(次要)': format_domains(teacher.get('minorPaper3Domain')),
                '研究方向': format_domains(teacher.get('researchArea')),
                '中文简介': teacher.get('chineseDescription'),
                '英文简介': teacher.get('omitDescription'),
                'PDF文件': os.path.basename(teacher.get('pdf_path', ''))
            })
        
        # 创建Excel writer对象
        with pd.ExcelWriter(excel_save_path, engine='openpyxl') as writer:
            # 保存表格
            df = pd.DataFrame(teacher_info)
            # 设置一些列的宽度
            df.to_excel(writer, sheet_name='教师信息', index=False)
            worksheet = writer.sheets['教师信息']
            
            # 设置列宽
            for idx, col in enumerate(df.columns):
                max_length = max(
                    df[col].astype(str).apply(len).max(),  # 最长的内容
                    len(str(col))  # 列名的长度
                )
                # 设置最小宽度为10，最大宽度为50
                adjusted_width = min(max(10, max_length + 2), 50)
                worksheet.column_dimensions[chr(65 + idx)].width = adjusted_width
        
        print(f"📊 Excel data saved to: {excel_save_path}")
        
    except Exception as e:
        print(f"\n❌ Error saving data: {e}")

if __name__ == "__main__":
    os.makedirs(pdf_save_path, exist_ok=True)
    
    start_time = datetime.now()
    token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJsb2dpblR5cGUiOiJsb2dpbiIsImxvZ2luSWQiOjExLCJkZXZpY2UiOiJkZWZhdWx0LWRldmljZSIsImVmZiI6MTc1NzU3MzQyNzQwOSwicm5TdHIiOiI5cVI2OG5VZ3d0MVhtb2ZnN2dybWtxcU1kWVlhaG1TaiJ9.NHD64NSk8yASWusq1MCPNrK1Jwwxiu5j2vR6TS7o664"
    
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
        max_workers = min(10, 10)
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
        
        # 保存所有教师数据到JSON和Excel文件
        save_teachers_data(all_teachers_data)
        
        # 显示最终统计信息
        end_time = datetime.now()
        duration = end_time - start_time
        print("\n📊 Processing Summary:")
        print(f"✅ Successful: {success_count}")
        print(f"❌ Failed: {failed_count}")
        print(f"⏱️ Total time: {duration.total_seconds():.2f} seconds")
        print(f"⚡ Average time per resume: {(duration.total_seconds() / total_talents):.2f} seconds")
