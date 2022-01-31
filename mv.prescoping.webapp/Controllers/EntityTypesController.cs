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
    public class EntityTypesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public EntityTypesController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: api/EntityTypes
        [HttpGet]
        public async Task<ActionResult<IEnumerable<EntityType>>> GetEntityTypes()
        {
            return await _context.EntityTypes.ToListAsync();
        }

        // GET: api/EntityTypes/5
        [HttpGet("{id}")]
        public async Task<ActionResult<EntityType>> GetEntityType(long id)
        {
            var entityType = await _context.EntityTypes.FindAsync(id);

            if (entityType == null)
            {
                return NotFound();
            }

            return entityType;
        }

        // PUT: api/EntityTypes/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutEntityType(long id, EntityType entityType)
        {
            if (id != entityType.Id)
            {
                return BadRequest();
            }

            _context.Entry(entityType).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!EntityTypeExists(id))
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

        // POST: api/EntityTypes
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<EntityType>> PostEntityType(EntityType entityType)
        {
            _context.EntityTypes.Add(entityType);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetEntityType", new { id = entityType.Id }, entityType);
        }

        // DELETE: api/EntityTypes/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteEntityType(long id)
        {
            var entityType = await _context.EntityTypes.FindAsync(id);
            if (entityType == null)
            {
                return NotFound();
            }

            _context.EntityTypes.Remove(entityType);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool EntityTypeExists(long id)
        {
            return _context.EntityTypes.Any(e => e.Id == id);
        }
    }
}
