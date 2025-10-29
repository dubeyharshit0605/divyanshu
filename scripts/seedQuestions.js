const mongoose = require('mongoose');
const Question = require('../models/Question');
require('dotenv').config();

const sampleQuestions = [
  // Data Structures Questions
  {
    question_id: 'DS001',
    question_text: 'Explain the difference between a stack and a queue. When would you use each?',
    domain: 'data_structures',
    difficulty: 'easy',
    expected_key_points: [
      'Stack follows LIFO (Last In, First Out) principle',
      'Queue follows FIFO (First In, First Out) principle',
      'Stack operations: push, pop, peek',
      'Queue operations: enqueue, dequeue, front',
      'Stack use cases: function calls, undo operations, expression evaluation',
      'Queue use cases: task scheduling, breadth-first search, buffering'
    ],
    sample_answer: 'A stack is a linear data structure that follows LIFO principle where elements are added and removed from the same end (top). A queue follows FIFO principle where elements are added at the rear and removed from the front. Stacks are used for function call management and undo operations, while queues are used for task scheduling and BFS algorithms.',
    tags: ['stack', 'queue', 'lifo', 'fifo', 'data-structures']
  },
  {
    question_id: 'DS002',
    question_text: 'How would you implement a hash table? What are the key considerations?',
    domain: 'data_structures',
    difficulty: 'medium',
    expected_key_points: [
      'Hash function design and distribution',
      'Collision handling strategies (chaining, open addressing)',
      'Load factor and resizing considerations',
      'Time complexity: O(1) average, O(n) worst case',
      'Space complexity considerations',
      'Hash function properties: deterministic, uniform distribution'
    ],
    sample_answer: 'A hash table uses a hash function to map keys to array indices. Key considerations include choosing a good hash function for uniform distribution, handling collisions through chaining or open addressing, managing load factor to maintain performance, and implementing dynamic resizing when needed.',
    tags: ['hash-table', 'hash-function', 'collision', 'load-factor']
  },
  {
    question_id: 'DS003',
    question_text: 'Design a data structure that supports insert, delete, and getRandom operations in O(1) time.',
    domain: 'data_structures',
    difficulty: 'hard',
    expected_key_points: [
      'Combination of array and hash map',
      'Array for O(1) random access',
      'Hash map for O(1) lookup and deletion',
      'Maintaining indices during deletion',
      'Swapping with last element for deletion',
      'Handling edge cases and duplicates'
    ],
    sample_answer: 'Use a combination of a dynamic array and a hash map. The array stores the actual elements, while the hash map stores element-to-index mappings. For deletion, swap the element with the last element in the array and update the hash map accordingly.',
    tags: ['randomized-set', 'hash-map', 'array', 'o1-operations']
  },

  // Algorithms Questions
  {
    question_id: 'ALG001',
    question_text: 'Explain the difference between BFS and DFS. When would you use each?',
    domain: 'algorithms',
    difficulty: 'easy',
    expected_key_points: [
      'BFS uses queue, DFS uses stack (or recursion)',
      'BFS explores level by level, DFS goes deep first',
      'BFS finds shortest path in unweighted graphs',
      'DFS uses less memory, BFS uses more memory',
      'BFS is better for finding shortest paths',
      'DFS is better for topological sorting, cycle detection'
    ],
    sample_answer: 'BFS explores nodes level by level using a queue, while DFS explores as far as possible along each branch before backtracking. BFS is used for shortest path problems and level-order traversal, while DFS is used for topological sorting, cycle detection, and when memory is limited.',
    tags: ['bfs', 'dfs', 'graph-traversal', 'shortest-path']
  },
  {
    question_id: 'ALG002',
    question_text: 'How would you find the longest common subsequence between two strings?',
    domain: 'algorithms',
    difficulty: 'medium',
    expected_key_points: [
      'Dynamic programming approach',
      '2D table to store subproblem results',
      'Recurrence relation: LCS(i,j) = LCS(i-1,j-1)+1 if chars match, else max(LCS(i-1,j), LCS(i,j-1))',
      'Time complexity: O(m*n)',
      'Space complexity: O(m*n) or O(min(m,n)) with optimization',
      'Backtracking to reconstruct the actual LCS'
    ],
    sample_answer: 'Use dynamic programming with a 2D table where dp[i][j] represents the LCS length of first i characters of string1 and first j characters of string2. Fill the table using the recurrence relation and backtrack to find the actual subsequence.',
    tags: ['lcs', 'dynamic-programming', 'string-algorithms', 'subsequence']
  },
  {
    question_id: 'ALG003',
    question_text: 'Design an algorithm to find the kth largest element in an unsorted array.',
    domain: 'algorithms',
    difficulty: 'medium',
    expected_key_points: [
      'Quickselect algorithm (modified quicksort)',
      'Heap-based approach (min-heap of size k)',
      'Sorting approach (O(n log n))',
      'Average case O(n), worst case O(n²) for quickselect',
      'O(n log k) for heap approach',
      'Partitioning strategy and pivot selection'
    ],
    sample_answer: 'Use the quickselect algorithm which is a variation of quicksort. Partition the array around a pivot and recursively search in the appropriate partition. Alternatively, use a min-heap of size k to maintain the k largest elements.',
    tags: ['quickselect', 'heap', 'kth-largest', 'partitioning']
  },

  // System Design Questions
  {
    question_id: 'SD001',
    question_text: 'How would you design a URL shortener like bit.ly?',
    domain: 'system_design',
    difficulty: 'medium',
    expected_key_points: [
      'Hash function to generate short URLs',
      'Database design for URL storage',
      'Handling collisions and custom URLs',
      'Caching strategy (Redis)',
      'Analytics and tracking',
      'Scalability considerations (sharding, load balancing)'
    ],
    sample_answer: 'Use a hash function to generate short codes, store mappings in a database with caching layer. Handle collisions by appending characters or using different hash functions. Implement analytics tracking and consider horizontal scaling with database sharding.',
    tags: ['url-shortener', 'hash-function', 'caching', 'scalability']
  },
  {
    question_id: 'SD002',
    question_text: 'Design a distributed cache system. How would you handle cache invalidation?',
    domain: 'system_design',
    difficulty: 'hard',
    expected_key_points: [
      'Consistent hashing for distribution',
      'Cache eviction policies (LRU, LFU, TTL)',
      'Cache invalidation strategies (write-through, write-behind)',
      'Handling cache misses and cold starts',
      'Replication and consistency models',
      'Monitoring and metrics'
    ],
    sample_answer: 'Use consistent hashing to distribute data across cache nodes. Implement write-through or write-behind strategies for invalidation. Use LRU eviction with TTL for automatic expiration. Handle cache misses gracefully and implement replication for high availability.',
    tags: ['distributed-cache', 'consistent-hashing', 'cache-invalidation', 'eviction']
  },

  // Database Questions
  {
    question_id: 'DB001',
    question_text: 'Explain the differences between SQL and NoSQL databases. When would you choose each?',
    domain: 'database',
    difficulty: 'easy',
    expected_key_points: [
      'SQL: ACID properties, structured schema, relational model',
      'NoSQL: flexible schema, horizontal scaling, various data models',
      'SQL: complex queries, transactions, consistency',
      'NoSQL: high performance, scalability, flexibility',
      'Use SQL for complex relationships and transactions',
      'Use NoSQL for high-scale, flexible data requirements'
    ],
    sample_answer: 'SQL databases provide ACID properties, structured schemas, and complex querying capabilities, making them ideal for applications requiring strong consistency and complex relationships. NoSQL databases offer flexibility, horizontal scaling, and high performance, making them suitable for big data and real-time applications.',
    tags: ['sql', 'nosql', 'acid', 'scalability', 'consistency']
  },
  {
    question_id: 'DB002',
    question_text: 'How would you optimize a slow database query?',
    domain: 'database',
    difficulty: 'medium',
    expected_key_points: [
      'Query analysis and profiling',
      'Index optimization (covering indexes, composite indexes)',
      'Query rewriting and optimization',
      'Database statistics and query planner',
      'Partitioning and sharding strategies',
      'Caching and materialized views'
    ],
    sample_answer: 'Analyze the query execution plan, add appropriate indexes, rewrite queries for better performance, update database statistics, consider partitioning large tables, and implement caching strategies. Use EXPLAIN to understand query execution and identify bottlenecks.',
    tags: ['query-optimization', 'indexing', 'profiling', 'performance']
  },

  // Networking Questions
  {
    question_id: 'NET001',
    question_text: 'Explain the difference between TCP and UDP. When would you use each?',
    domain: 'networking',
    difficulty: 'easy',
    expected_key_points: [
      'TCP: connection-oriented, reliable, ordered delivery',
      'UDP: connectionless, unreliable, no ordering guarantees',
      'TCP: higher overhead, flow control, congestion control',
      'UDP: lower overhead, faster, no flow control',
      'Use TCP for reliable data transfer (HTTP, FTP)',
      'Use UDP for real-time applications (video, gaming)'
    ],
    sample_answer: 'TCP provides reliable, ordered delivery with connection establishment and error recovery, making it suitable for applications requiring data integrity. UDP is faster with lower overhead but no reliability guarantees, making it ideal for real-time applications where speed matters more than perfect delivery.',
    tags: ['tcp', 'udp', 'reliability', 'performance', 'protocols']
  },

  // Security Questions
  {
    question_id: 'SEC001',
    question_text: 'What are the main types of SQL injection attacks and how can you prevent them?',
    domain: 'security',
    difficulty: 'medium',
    expected_key_points: [
      'Union-based, Boolean-based, Time-based SQL injection',
      'Input validation and sanitization',
      'Parameterized queries and prepared statements',
      'Least privilege principle for database access',
      'Web Application Firewall (WAF)',
      'Regular security testing and code reviews'
    ],
    sample_answer: 'SQL injection attacks include union-based, boolean-based, and time-based techniques. Prevention involves using parameterized queries, input validation, least privilege database access, and implementing security measures like WAFs and regular security testing.',
    tags: ['sql-injection', 'security', 'prepared-statements', 'validation']
  }
];

async function seedQuestions() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/oops_interview');
    console.log('Connected to MongoDB');

    // Clear existing questions
    await Question.deleteMany({});
    console.log('Cleared existing questions');

    // Insert sample questions
    await Question.insertMany(sampleQuestions);
    console.log(`Inserted ${sampleQuestions.length} sample questions`);

    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the seeding function
if (require.main === module) {
  seedQuestions();
}

module.exports = { sampleQuestions, seedQuestions };
