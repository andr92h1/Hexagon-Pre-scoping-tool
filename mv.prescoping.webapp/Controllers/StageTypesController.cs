using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using mv.prescoping.db;

namespace mv.prescoping.webapp.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class StageTypesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public StageTypesController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: api/StageTypes
        [HttpGet]
        public async Task<ActionResult<IEnumerable<StageType>>> GetStageTypes()
        {
            return await _context.StageTypes.ToListAsync();
        }

        // GET: api/StageTypes/5
        [HttpGet("{id}")]
        public async Task<ActionResult<StageType>> GetStageType(long id)
        {
            var stageType = await _context.StageTypes.FindAsync(id);

            if (stageType == null)
            {
                return NotFound();
            }

            return stageType;
        }

        // PUT: api/StageTypes/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutStageType(long id, StageType stageType)
        {
            if (id != stageType.Id)
            {
                return BadRequest();
            }

            _context.Entry(stageType).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!StageTypeExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // POST: api/StageTypes
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<StageType>> PostStageType(StageType stageType)
        {
            _context.StageTypes.Add(stageType);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetStageType", new { id = stageType.Id }, stageType);
        }

        // DELETE: api/StageTypes/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteStageType(long id)
        {
            var stageType = await _context.StageTypes.FindAsync(id);
            if (stageType == null)
            {
                return NotFound();
            }

            _context.StageTypes.Remove(stageType);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool StageTypeExists(long id)
        {
            return _context.StageTypes.Any(e => e.Id == id);
        }
    }
}
