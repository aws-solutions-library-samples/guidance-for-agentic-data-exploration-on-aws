import os
import boto3
import json
import logging
import time

from langchain.chains import NeptuneOpenCypherQAChain
from langchain_community.graphs import NeptuneGraph
from langchain_core.prompts import PromptTemplate
from langchain_aws import ChatBedrockConverse

from langchain.globals import set_debug
set_debug(True)

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Get environment variables
neptune_host = os.environ.get('NEPTUNE_HOST')
neptune_port = os.environ.get('NEPTUNE_PORT', '8182')
llm_model = os.environ.get('LLM_MODEL', 'us.anthropic.claude-3-5-sonnet-20240620-v1:0')

# Module level variables for connection caching
_graph_connection = None
_qa_chain = None

# Templates for QA Chain
CYPHER_CUSTOM_TEMPLATE = """<Instructions>
Generate the query in openCypher format and follow these rules:
1. Use undirected relationship for MATCH query.
2. Do not use `NONE`, `ALL` or `ANY` predicate functions, rather use list comprehensions.
3. Do not use `REDUCE` function. Rather use a combination of list comprehension and the `UNWIND` clause to achieve similar results.
4. Do not use `FOREACH` clause. Rather use a combination of `WITH` and `UNWIND` clauses to achieve similar results.
5. Use only the provided relationship types and properties in the schema.
6. Do not use any other relationship types or properties that are not provided.
7. Do not use new line.
</Instructions>

<schema>
{schema}
<schema>

<example>
question: can Emily access the project Turbo-Project?
cypher: MATCH (p:Project {{name: 'Turbo-Project'}})-[r:team_member]->(e:Employee {{name: 'Emily'}}) RETURN r.access
</example>
<example>
question: can Thomas access the project Turbo-Project?
cypher: MATCH (p:Project {{name: 'Turbo-Project'}})-[r:team_member]->(e:Employee {{name: 'Thomas'}})RETURN r.access
</example>
<example>
question: can you list the requirement, part and documents associated with the defect QC-1234-1?
cypher: MATCH (qc:QualityDefect {{name: "QC-1234-1"}})<-[:quality_defect]-(op:Operation)<-[:operation]-(po:ProductionOrder)<-[:production_order]-(part:Part)-[:specification|allocation_by_requirements]->(node) WHERE ((node:Requirement AND toLower(node.description) CONTAINS "rpm") OR (node:Document AND toLower(node.name) CONTAINS "cad")) RETURN node.name AS node_name,nCASE WHEN node:Requirement THEN node.description END AS req_desc, CASE WHEN node:Requirement THEN node.name END AS req_name, CASE WHEN node:Document THEN node.name END AS doc_name, CASE WHEN node:Document THEN node.description END AS doc_description, part.name AS part_name
</example>
<example>
question: Who are the suppliers for the part Turbo-Motor-11234?
cypher: MATCH (p:Part {{name: 'Turbo-Motor-11234'}})-[:supplied_by]-(s:Supplier) RETURN s.name AS supplier_name 
</example>

Note: Do not include any explanations or apologies in your responses.
Do not respond to any questions that might ask anything else than for you to construct a Cypher statement.
Do not include any text except the generated Cypher statement.

The question is:
{question}
\n"""

CUSTOM_QA_TEMPLATE= """You are an assistant that helps to form nice and human understandable answers.
The information part contains the provided information that you must use to construct an answer.
The provided information is authoritative, you must never doubt it or try to use your internal knowledge to correct it.
Make the answer sound as a response to the question. 
Construct the text based on the information and result. Respond concisely using data tables or lists to present information when possible.
Information:
{context}

Question: {question}
Helpful Answer:"""

def get_graph_connection():
    """
    Initialize and return a Neptune graph connection.
    Uses a cached connection if available.
    """
    global _graph_connection
    
    if _graph_connection is None:
        logger.info(f'Initializing new Neptune graph connection to {neptune_host}:{neptune_port}')
        try:
            _graph_connection = NeptuneGraph(
                host=neptune_host, 
                port=neptune_port, 
                use_https=True
            )
            # Test the connection
            # test_query = "MATCH (n) RETURN COUNT(n) LIMIT 1"
            # result = _graph_connection.query(test_query)
            # logger.info(f"Neptune connection test successful: {result}")
        except Exception as e:
            logger.error(f"Failed to initialize Neptune connection: {str(e)}")
            raise
    
    return _graph_connection
    
def get_qa_chain():
    """
    Initialize and return a QA chain.
    Uses a cached QA chain if available.
    """
    global _qa_chain
    
    if _qa_chain is None:
        logger.info('Initializing new QA chain')
        
        try:
            # Initialize LLM
            llm = ChatBedrockConverse(
                model=llm_model,
                temperature=0.01,
                max_tokens=4096
            )
            logger.info(f"LLM initialized with model: {llm_model}")

            # Get graph connection
            graph = get_graph_connection()
            
            # Create prompts
            qa_prompt = PromptTemplate(input_variables=["context", "question"], template=CUSTOM_QA_TEMPLATE)
            cypher_prompt = PromptTemplate(input_variables=["schema", "question"], template=CYPHER_CUSTOM_TEMPLATE)

            # Create the QA chain
            logger.info("Creating NeptuneOpenCypherQAChain")
            _qa_chain = NeptuneOpenCypherQAChain.from_llm(
                llm=llm, 
                graph=graph, 
                qa_prompt=qa_prompt,
                cypher_prompt=cypher_prompt,
                verbose=True, 
                top_K=10, 
                return_intermediate_steps=True,
                return_direct=False,
                allow_dangerous_requests=True
            )
            logger.info("QA chain successfully created")
            
        except Exception as e:
            logger.error(f"Failed to initialize QA chain: {str(e)}")
            raise
    
    return _qa_chain
    
def lambda_handler(event, context):
    """
    Main Lambda handler function.
    """
    logger.info(f"Event: {json.dumps(event)}")

    agent = event['agent']
    actionGroup = event['actionGroup']
    function = event['function']
    parameters = event.get('parameters', [])

    try:
        # Get the user query from the event
        if 'inputText' not in event: 
            logger.error("Query parameter is required")
            return {
                'actionGroup': actionGroup,
                'function': function,
                'functionResponse': {
                    'responseBody': {
                        'TEXT': {
                            "body": json.dumps('Query parameter is required')
                        }
                    }
                }
            }
        
        user_query = event['inputText']
        logger.info(f"Processing user query: {user_query}")

        try:
            # Get cached QA chain
            qa_chain = get_qa_chain()
            
            # Execute the query
            logger.info("Executing QA chain")
            start_time = time.time()
            output = qa_chain.invoke(user_query)
            end_time = time.time()
            logger.info(f"QA chain execution completed in {end_time - start_time:.2f} seconds")
            
            # Log the output for debugging
            logger.info(f"QA Chain output keys: {list(output.keys())}")
            
            # Extract intermediate steps and result
            if 'intermediate_steps' not in output:
                logger.error("No intermediate_steps in output")
                raise ValueError("QA Chain did not return intermediate steps")
                
            intermediate_steps = output['intermediate_steps']
            logger.info(f"Intermediate steps: {json.dumps(intermediate_steps, indent=2)}")
            
            if not intermediate_steps or 'query' not in intermediate_steps[0]:
                logger.error("Invalid intermediate steps format")
                raise ValueError("Invalid intermediate steps format")
            
            query = intermediate_steps[0]['query']
            result = output['result']
            
            logger.info(f"Generated query: {query}")
            logger.info(f"Query result: {result}")
            
            
        except Exception as e:
            logger.error(f"Exception: {str(e)}")
            

        # Prepare response
        responseBody = {
            "TEXT": {
                "body": json.dumps(f"{result} \n\n `🤖 {query}`")
            }
        }

        action_response = {
            'actionGroup': actionGroup,
            'function': function,
            'functionResponse': {
                'responseBody': responseBody
            }
        }        

        agent_response = {'response': action_response, 'messageVersion': event['messageVersion']}
        print("Response: {}".format(function))

        return agent_response
   
    except Exception as e:
        logger.error(f"Error in lambda_handler: {str(e)}", exc_info=True)
        return {
            'actionGroup': actionGroup,
            'function': function,
            'functionResponse': {
                'responseBody': {
                    'TEXT': {
                        "body": f"An error occurred while processing your request: {str(e)}"
                    }
                }
            }
        }
